import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { AdminsModule } from './admins/admins.module';
import { CoursesModule } from './courses/courses.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AuthModule } from './auth/auth.module';
import { DecoratorsModule } from './common/decorators/decorators.module';
import { GuardsModule } from './common/guards/guards.module';
import { FiltersModule } from './common/filters/filters.module';
import { DtoModule } from './common/dto/dto.module';
import { ConfigModule } from './config/config.module';
import { RolesModule } from './roles/roles.module';
import { OwnerModule } from './owner/owner.module';
import { ParentsModule } from './parents/parents.module';
import { GroupsModule } from './groups/groups.module';
import { SchedulesModule } from './schedules/schedules.module';
import { PaymentsModule } from './payments/payments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HomeworkModule } from './homework/homework.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StatisticsModule } from './statistics/statistics.module';


@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    UsersModule,
    StudentsModule,
    TeachersModule,
    AdminsModule,
    CoursesModule,
    ScheduleModule,
    DecoratorsModule,
    GuardsModule,
    FiltersModule,
    DtoModule,
    ConfigModule,
    RolesModule,
    OwnerModule,
    ParentsModule,
    GroupsModule,
    SchedulesModule,
    PaymentsModule,
    AttendanceModule,
    HomeworkModule,
    NotificationsModule,
    StatisticsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('PORT:', process.env.PORT);
console.log("http://localhost:3000"); 