import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { Statistic, StatisticSchema } from './schemas/statistic.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Statistic.name, schema: StatisticSchema },
    { name: Group.name, schema: GroupSchema },
    { name: User.name, schema: UserSchema },
  ])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
