import { Socket, connect as netConnect } from 'node:net';
import { TLSSocket, connect as tlsConnect } from 'node:tls';

export interface RedisRateLimitClient {
  ping(): Promise<void>;
  incrementWithExpiry(key: string, ttlMs: number): Promise<number>;
}

type RedisSocket = Socket | TLSSocket;

const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

function encodeCommand(parts: Array<string | number>): string {
  return `*${parts.length}\r\n${parts
    .map((part) => {
      const value = String(part);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    })
    .join('')}`;
}

class RespParser {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  parse(): unknown {
    const prefix = String.fromCharCode(this.buffer[this.offset]);
    this.offset += 1;

    if (prefix === '+') {
      return this.readLine();
    }

    if (prefix === '-') {
      throw new Error(this.readLine());
    }

    if (prefix === ':') {
      return Number(this.readLine());
    }

    if (prefix === '$') {
      const length = Number(this.readLine());
      if (length === -1) {
        return null;
      }

      const value = this.buffer
        .subarray(this.offset, this.offset + length)
        .toString();
      this.offset += length + 2;
      return value;
    }

    if (prefix === '*') {
      const length = Number(this.readLine());
      if (length === -1) {
        return null;
      }

      return Array.from({ length }, () => this.parse());
    }

    throw new Error(`Unsupported Redis response prefix: ${prefix}`);
  }

  private readLine(): string {
    const end = this.buffer.indexOf('\r\n', this.offset);
    if (end === -1) {
      throw new Error('Incomplete Redis response');
    }

    const value = this.buffer.subarray(this.offset, end).toString();
    this.offset = end + 2;
    return value;
  }
}

export class TcpRedisRateLimitClient implements RedisRateLimitClient {
  private readonly url: URL;

  constructor(
    redisUrl: string,
    private readonly timeoutMs = 5000,
  ) {
    this.url = new URL(redisUrl);
  }

  async ping(): Promise<void> {
    await this.runCommand(['PING']);
  }

  async incrementWithExpiry(key: string, ttlMs: number): Promise<number> {
    const result = await this.runCommand([
      'EVAL',
      RATE_LIMIT_SCRIPT,
      1,
      key,
      ttlMs,
    ]);
    if (typeof result !== 'number') {
      throw new Error('Unexpected Redis rate limit response');
    }

    return result;
  }

  private async runCommand(parts: Array<string | number>): Promise<unknown> {
    const socket = await this.openSocket();

    try {
      if (this.url.password) {
        await this.writeAndRead(
          socket,
          this.url.username
            ? [
                'AUTH',
                decodeURIComponent(this.url.username),
                decodeURIComponent(this.url.password),
              ]
            : ['AUTH', decodeURIComponent(this.url.password)],
        );
      }

      const db = this.url.pathname.replace('/', '');
      if (db) {
        await this.writeAndRead(socket, ['SELECT', db]);
      }

      return await this.writeAndRead(socket, parts);
    } finally {
      socket.end();
    }
  }

  private openSocket(): Promise<RedisSocket> {
    const isTls = this.url.protocol === 'rediss:';
    const port = Number(this.url.port || (isTls ? 6380 : 6379));
    const host = this.url.hostname;

    return new Promise((resolve, reject) => {
      const socket = isTls
        ? tlsConnect({ host, port, servername: host })
        : netConnect({ host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Redis connection timed out'));
      }, this.timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  private writeAndRead(
    socket: RedisSocket,
    parts: Array<string | number>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Redis command timed out'));
      }, this.timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off('data', onData);
        socket.off('error', onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        try {
          const response = new RespParser(Buffer.concat(chunks)).parse();
          cleanup();
          resolve(response);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Incomplete Redis response'
          ) {
            return;
          }
          cleanup();
          reject(error);
        }
      };

      socket.on('data', onData);
      socket.once('error', onError);
      socket.write(encodeCommand(parts));
    });
  }
}
