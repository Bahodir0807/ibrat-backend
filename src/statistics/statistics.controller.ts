import { Body, Controller, Get, Param, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() createStatisticDto: CreateStatisticDto) {
    return this.statisticsService.create(createStatisticDto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  findAll() {
    return this.statisticsService.findAll();
  }

  @Get(':type')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  findByType(@Param('type') type: string) {
    return this.statisticsService.findByType(type);
  }
}
