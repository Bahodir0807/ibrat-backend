import { Controller, Get, Post, Patch, Delete, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('user/:userId')
  async getByUser(@Param('userId') userId: string) {
    return this.gradesService.getByUser(userId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async add(@Body() dto: CreateGradeDto) {
    return this.gradesService.add(dto.userId, dto.subject, dto.score);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(id, dto.score ?? 0);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.gradesService.remove(id);
  }
}
