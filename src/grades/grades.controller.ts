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
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { IdParamDto } from '../common/dto/id-param.dto';
import { UserIdParamDto } from '../common/dto/user-id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('me')
  @Roles(Role.Student)
  async getMine(@Request() req) {
    return this.gradesService.getByUserForActor(req.user.userId, req.user as AuthenticatedUser);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param() params: UserIdParamDto, @Request() req) {
    const { userId } = params;
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own grades');
    }

    return this.gradesService.getByUserForActor(userId, req.user as AuthenticatedUser);
  }

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  async add(@Body() dto: CreateGradeDto, @Request() req) {
    return this.gradesService.addForActor(
      dto.userId,
      dto.subject,
      dto.score,
      req.user as AuthenticatedUser,
    );
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  async update(@Param() params: IdParamDto, @Body() dto: UpdateGradeDto, @Request() req) {
    return this.gradesService.updateForActor(params.id, dto.score, req.user as AuthenticatedUser);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  async remove(@Param() params: IdParamDto, @Request() req) {
    const grade = await this.gradesService.removeForActor(
      params.id,
      req.user as AuthenticatedUser,
    );
    return { message: 'Grade deleted successfully', deleted: grade };
  }
}
