import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('me')
  @Roles(Role.Student, Role.Teacher, Role.Admin, Role.Owner)
  async getMine(@Request() req) {
    return this.gradesService.getByUser(req.user.userId);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param('userId') userId: string, @Request() req) {
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own grades');
    }

    return this.gradesService.getByUser(userId);
  }

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async add(@Body() dto: CreateGradeDto) {
    return this.gradesService.add(dto.userId, dto.subject, dto.score);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(id, dto.score ?? 0);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  async remove(@Param('id') id: string) {
    return this.gradesService.remove(id);
  }
}
