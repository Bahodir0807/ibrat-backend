import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Request,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { UsersService } from '../users/users.service';
import { decrypt } from '../common/encryption';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: { username: string; password: string },
  ): Promise<{ access_token: string }> {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.authService.login(user);
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (e) {
      console.error('Ошибка регистрации:', e);
      throw e;
    }
  }
  

  @Post('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return req.user;
  }

  @Get('decrypt/:username')
  @UseGuards(JwtAuthGuard, RolesGuard) 
  @Roles(Role.Admin, Role.Owner)
  async decryptPassword(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');

    const password = decrypt(user.password);
    return { password };
  }
}
