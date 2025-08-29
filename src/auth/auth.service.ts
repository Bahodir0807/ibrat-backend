import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { encrypt, decrypt } from '../common/encryption';
import { Role } from '../roles/roles.enum';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPER_ROLE_KEY = process.env.SUPER_ROLE_KEY;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto & { roleKey?: string }) {
    let role: Role = Role.Guest;

    if (dto.role === Role.Student) {
      role = Role.Student;
    }

    if (dto.role && dto.role !== Role.Student && dto.role !== Role.Guest) {
      throw new BadRequestException(
        'При регистрации доступны только роли "student" или "guest"',
      );
    }

    return this.usersService.create({
      ...dto,
      password: encrypt(dto.password),
      role,
    });
  }

  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) return null;

    try {
      const decryptedPassword = decrypt(user.password);
      if (decryptedPassword !== pass) return null;
    } catch (err) {
      console.error('Ошибка расшифровки:', err);
      return null;
    }

    return user;
  }

  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user._id,
      role: user.role,
    };

    return {
      token: this.jwtService.sign(payload),
      role: user.role,
    };
  }
}
