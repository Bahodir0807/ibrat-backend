import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { MongooseModule } from '@nestjs/mongoose';
import { Reflector, APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './roles/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { SchedulesModule } from './schedule/schedule.module';
import { AuthModule } from './auth/auth.module';
import { DecoratorsModule } from './common/decorators/decorators.module';
import { GuardsModule } from './common/guards/guards.module';
import { FiltersModule } from './common/filters/filters.module';
import { DtoModule } from './common/dto/dto.module';
import { RolesModule } from './roles/roles.module';
import { ParentsModule } from './parents/parents.module';
import { GroupsModule } from './groups/groups.module';
import { PaymentsModule } from './payments/payments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HomeworkModule } from './homework/homework.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StatisticsModule } from './statistics/statistics.module';
import { TelegramModule } from './telegram/telegram.module';
import { GradesModule } from './grades/grades.module';
import { UsersService } from './users/users.service';


@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    UsersModule,
    CoursesModule,
    DecoratorsModule,
    GuardsModule,
    FiltersModule,
    DtoModule,
    RolesModule,
    ParentsModule,
    GroupsModule,
    SchedulesModule,
    PaymentsModule,
    AttendanceModule,
    HomeworkModule,
    NotificationsModule,
    StatisticsModule,
    TelegramModule,
    GradesModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector],
    },
  ],
})
export class AppModule {}
console.log("http://localhost:3000"); 