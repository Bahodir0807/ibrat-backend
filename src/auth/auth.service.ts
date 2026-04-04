import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../roles/roles.enum';
import { PublicUser } from '../users/types/public-user.type';
import { verifyPassword } from '../common/password';

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
        'Only "student" and "guest" roles are available during self-registration',
      );
    }

    return this.usersService.create({
      ...dto,
      role,
    });
  }

  async validateUser(username: string, password: string): Promise<PublicUser | null> {
    const user = await this.usersService.findByUsernameForAuth(username);
    if (!user) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return this.usersService.findById(String(user._id));
  }

  async login(user: PublicUser) {
    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };

    return {
      token: this.jwtService.sign(payload),
      role: user.role,
      user,
    };
  }
}
