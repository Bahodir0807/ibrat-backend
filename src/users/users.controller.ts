import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    usersService: UsersService;

    @Get()
    getUsers() {
      return this.usersService.findAll();
    }
    @Get(':id')
    getUserById() { 
      return this.usersService.findOne();
    } 
    @Get('me')
    getMe() {
      return this.usersService.me();
    }
    
}
