import { Injectable } from '@nestjs/common';
import { UsersService } from './users/users.service';

@Injectable()
export class AppService {
  constructor(private readonly usersService: UsersService) {}

  getHello(): string {
    return 'Тудум тудум...';
  }

  async getUserCount(): Promise<number> {
    const users = await this.usersService.findAll();
    return users.length;
  }
}
