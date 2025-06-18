import { Controller, Get, Post, Body, Param, Patch, UsePipes, ValidationPipe } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';

@Controller('homework')
export class HomeworkController {
  constructor(private readonly hwService: HomeworkService) {}

  @Get('user/:userId')
  async getByUser(@Param('userId') userId: string) {
    return this.hwService.getByUser(userId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateHomeworkDto) {
    return this.hwService.create(dto);
  }
  

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    return this.hwService.markComplete(id);
  }
}
