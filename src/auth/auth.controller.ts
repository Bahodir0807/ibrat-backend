import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { Public } from '../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const loginResult = await this.authService.login(user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.auditLogService.log({
      action: 'auth.login',
      actor: { id: user.id, role: user.role },
      target: { type: 'user', id: user.id },
      status: 'success',
    });

    return loginResult;
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Request() req) {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto, @Request() req) {
    await this.authService.logout(req.user.userId, dto.refreshToken);
    this.auditLogService.log({
      action: 'auth.logout',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id: req.user.userId },
      status: 'success',
    });
    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    await this.authService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    this.auditLogService.log({
      action: 'auth.password.change',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id: req.user.userId },
      status: 'success',
    });
    return { message: 'Password changed successfully' };
  }

  @Get('me')
  async getProfileGet(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Post('me')
  async getProfilePost(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }
}
