import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Grade, GradeSchema } from './schemas/grade.schema';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Grade.name, schema: GradeSchema }])],
  providers: [GradesService],
  controllers: [GradesController],
  exports: [GradesService],
})
export class GradesModule {}
