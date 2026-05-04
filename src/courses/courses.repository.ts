import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ProjectionType, UpdateQuery } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';

@Injectable()
export class CoursesRepository {
  constructor(@InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>) {}

  find(filter: FilterQuery<CourseDocument> = {}, projection?: ProjectionType<CourseDocument>) {
    return this.courseModel.find(filter, projection);
  }

  findById(id: unknown, projection?: ProjectionType<CourseDocument>) {
    return this.courseModel.findById(id, projection);
  }

  countDocuments(filter: FilterQuery<CourseDocument>) {
    return this.courseModel.countDocuments(filter);
  }

  create(payload: Record<string, unknown>) {
    return this.courseModel.create(payload);
  }

  updateById(id: string, payload: UpdateQuery<CourseDocument>) {
    return this.courseModel.findByIdAndUpdate(id, payload, { new: true });
  }

  deleteById(id: string) {
    return this.courseModel.findByIdAndDelete(id);
  }

  exists(filter: FilterQuery<CourseDocument>) {
    return this.courseModel.exists(filter);
  }
}
