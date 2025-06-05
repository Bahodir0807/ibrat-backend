import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { AdminsModule } from './admins/admins.module';
import { CoursesModule } from './courses/courses.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [UsersModule, StudentsModule, TeachersModule, AdminsModule, CoursesModule, ScheduleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
