import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    return this.usersService.create({
      ...dto,
      password: dto.password,
    });
  }

  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      return null;
    }

    if (user.password !== pass) {
      return null;
    }

    return user;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user._id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
