import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { TypeParamDto } from '../common/dto/type-param.dto';
import { StatisticsListQueryDto } from './dto/statistics-list-query.dto';
import { IdParamDto } from '../common/dto/id-param.dto';
import { UpdateStatisticDto } from './dto/update-statistic.dto';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  create(@Body() createStatisticDto: CreateStatisticDto, @Request() req) {
    return this.statisticsService.createForActor(createStatisticDto, req.user);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findAll(@Query() query: StatisticsListQueryDto, @Request() req) {
    return this.statisticsService.findAllForActor(query, req.user);
  }

  @Get(':type')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findByType(@Param() params: TypeParamDto, @Query() query: StatisticsListQueryDto, @Request() req) {
    return this.statisticsService.findByTypeForActor(params.type, query, req.user);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  update(@Param() params: IdParamDto, @Body() dto: UpdateStatisticDto, @Request() req) {
    return this.statisticsService.updateForActor(params.id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto, @Request() req) {
    await this.statisticsService.removeForActor(params.id, req.user);
    return { message: 'Statistic deleted successfully' };
  }
}
