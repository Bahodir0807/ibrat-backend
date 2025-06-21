import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const algorithm = 'aes-256-cbc';
const secret = process.env.ENCRYPTION_SECRET!;
const salt = process.env.ENCRYPTION_SALT!;
const key = crypto.scryptSync(secret, salt, 32); 

const ivLength = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  if (!text.includes(':')) {
    throw new Error('Неверный формат зашифрованной строки');
  }

  const [ivHex, encryptedText] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
