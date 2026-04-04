import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Public()
  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const loginResult = await this.authService.login(user);
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfileGet(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  async getProfilePost(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }
}
