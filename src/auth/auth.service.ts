import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../roles/roles.enum';
import { PublicUser } from '../users/types/public-user.type';
import { verifyPassword } from '../common/password';
import { AppConfigService } from '../config/app-config.service';
import { AuthSession, AuthSessionDocument } from './schemas/auth-session.schema';
import { UserStatus } from '../users/user-status.enum';
import { canAuthenticateWithStatus, resolveUserStatus } from '../users/user-status';

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type TokenPayload = {
  sub: string;
  username: string;
  role: Role;
  status: UserStatus;
  branchIds: string[];
  type: 'access' | 'refresh';
  jti?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
    @InjectModel(AuthSession.name)
    private readonly authSessionModel: Model<AuthSessionDocument>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUserAllowedToAuthenticate(user: Pick<PublicUser, 'status' | 'isActive'>): boolean {
    return canAuthenticateWithStatus(resolveUserStatus(user));
  }

  private parseTtlToSeconds(value: string): number {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 0;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 60 * 60 * 24,
    };

    return amount * multipliers[unit];
  }

  private getExpiryDate(ttl: string): Date {
    const ttlSeconds = this.parseTtlToSeconds(ttl);
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  private async revokeSession(
    sessionId: string,
    reason: string,
    replacedByTokenId?: string,
  ): Promise<void> {
    await this.authSessionModel.findByIdAndUpdate(sessionId, {
      revokedAt: new Date(),
      revokeReason: reason,
      ...(replacedByTokenId ? { replacedByTokenId } : {}),
    }).exec();
  }

  private async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    await this.authSessionModel.updateMany(
      { user: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokeReason: reason },
    ).exec();
  }

  private async buildTokenPair(user: PublicUser, context?: RequestContext) {
    const accessPayload: TokenPayload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      status: user.status,
      branchIds: user.branchIds ?? [],
      type: 'access',
    };

    const refreshTokenId = randomUUID();
    const refreshPayload: TokenPayload = {
      ...accessPayload,
      type: 'refresh',
      jti: refreshTokenId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.appConfigService.jwtSecret,
        expiresIn: this.appConfigService.jwtExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.appConfigService.jwtRefreshSecret,
        expiresIn: this.appConfigService.jwtRefreshExpiresIn,
      }),
    ]);

    await this.authSessionModel.create({
      user: user.id,
      tokenId: refreshTokenId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: this.getExpiryDate(this.appConfigService.jwtRefreshExpiresIn),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      lastUsedAt: new Date(),
      lastUsedUserAgent: context?.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      tokenType: 'Bearer',
      expiresIn: this.parseTtlToSeconds(this.appConfigService.jwtExpiresIn),
      refreshExpiresIn: this.parseTtlToSeconds(this.appConfigService.jwtRefreshExpiresIn),
      user,
    };
  }

  private async validateRefreshToken(refreshToken: string) {
    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.appConfigService.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.authSessionModel
      .findOne({ tokenId: payload.jti, user: payload.sub })
      .exec();

    if (!session || session.tokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(payload.sub, 'refresh-token-reuse-detected');
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeSession(String(session._id), 'refresh-token-expired');
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!this.isUserAllowedToAuthenticate(user)) {
      await this.revokeAllUserSessions(user.id, 'user-no-longer-allowed-to-authenticate');
      throw new UnauthorizedException('User is not allowed to authenticate');
    }

    return { payload, session, user };
  }

  async register(dto: RegisterDto & { roleKey?: string }) {
    let role: Role = Role.Guest;

    if (dto.role === Role.Student) {
      role = Role.Student;
    }

    if (dto.role && dto.role !== Role.Student && dto.role !== Role.Guest) {
      throw new BadRequestException(
        'Only "student" and "guest" roles are available during self-registration',
      );
    }

    return this.usersService.create({
      ...dto,
      role,
      status: UserStatus.Active,
    });
  }

  async validateUser(username: string, password: string): Promise<PublicUser | null> {
    const user = await this.usersService.findByUsernameForAuth(username);
    if (!user) {
      return null;
    }

    if (!this.isUserAllowedToAuthenticate({
      status: resolveUserStatus(user),
      isActive: user.isActive,
    })) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return this.usersService.findById(String(user._id));
  }

  async login(user: PublicUser, context?: RequestContext) {
    if (!this.isUserAllowedToAuthenticate(user)) {
      throw new UnauthorizedException('User is not allowed to authenticate');
    }

    return this.buildTokenPair(user, context);
  }

  async refresh(refreshToken: string, context?: RequestContext) {
    const { session, user } = await this.validateRefreshToken(refreshToken);
    const nextTokens = await this.buildTokenPair(user, context);

    await this.revokeSession(
      String(session._id),
      'refresh-token-rotated',
      this.extractRefreshTokenId(nextTokens.refreshToken),
    );

    return nextTokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const { payload, session } = await this.validateRefreshToken(refreshToken);

    if (payload.sub !== userId) {
      throw new UnauthorizedException('Refresh token does not belong to the current user');
    }

    await this.revokeSession(String(session._id), 'user-logout');
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.usersService.changePassword(userId, currentPassword, newPassword);
    await this.revokeAllUserSessions(userId, 'password-changed');
  }

  private extractRefreshTokenId(refreshToken: string): string | undefined {
    try {
      const payload = this.jwtService.decode(refreshToken) as TokenPayload | null;
      return payload?.jti;
    } catch {
      return undefined;
    }
  }
}
