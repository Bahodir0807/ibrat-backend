import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { Role } from '../../roles/roles.enum';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import { canAuthenticateWithStatus, resolveUserStatus } from '../../users/user-status';
import { UserStatus } from '../../users/user-status.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly usersService: UsersService,
  ) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfigService.jwtSecret,
    };
    super(options);
  }

  async validate(payload: { sub: string; username: string; role: Role; branchIds?: string[]; iat?: number }) {
    const user = await this.usersService.findByIdDoc(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User is no longer active');
    }

    const status = resolveUserStatus(user as { status?: UserStatus; isActive?: boolean });
    if (!canAuthenticateWithStatus(status)) {
      throw new UnauthorizedException('User is no longer active');
    }

    const issuedAtMs = typeof payload.iat === 'number'
      ? payload.iat * 1000
      : undefined;
    const passwordChangedAtMs = user.passwordChangedAt?.getTime();
    if (issuedAtMs && passwordChangedAtMs && issuedAtMs < passwordChangedAtMs) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return {
      userId: String(user._id),
      username: user.username,
      role: user.role,
      branchIds: Array.isArray(user.branchIds)
        ? user.branchIds
            .filter((branchId): branchId is string => typeof branchId === 'string')
            .map(branchId => branchId.trim())
            .filter(branchId => branchId.length > 0)
        : [],
    };
  }
}
