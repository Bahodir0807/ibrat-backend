import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { TypeParamDto } from '../common/dto/type-param.dto';
import { StatisticsListQueryDto } from './dto/statistics-list-query.dto';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  create(@Body() createStatisticDto: CreateStatisticDto) {
    return this.statisticsService.create(createStatisticDto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  findAll(@Query() query: StatisticsListQueryDto) {
    return this.statisticsService.findAll(query);
  }

  @Get(':type')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  findByType(@Param() params: TypeParamDto, @Query() query: StatisticsListQueryDto) {
    return this.statisticsService.findByType(params.type, query);
  }
}
