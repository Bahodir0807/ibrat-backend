import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course, CourseDocument } from './schemas/course.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { CoursesListQueryDto } from './dto/courses-list-query.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
  ) {}

  private readonly coursePopulate = [
    { path: 'teacherId', select: 'username firstName lastName role email phoneNumber' },
    { path: 'students', select: 'username firstName lastName role email phoneNumber' },
  ];

  async findDocumentById(id: string): Promise<CourseDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.courseModel.findById(id).exec();
  }

  private toObjectId(id?: string): Types.ObjectId | undefined {
    if (!id) {
      return undefined;
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Mongo ID');
    }

    return new Types.ObjectId(id);
  }

  private normalizePayload(dto: CreateCourseDto | UpdateCourseDto) {
    const payload: Record<string, unknown> = { ...dto };

    if ('teacherId' in dto && dto.teacherId !== undefined) {
      payload.teacherId = dto.teacherId ? this.toObjectId(dto.teacherId) : undefined;
    }

    if ('students' in dto && dto.students !== undefined) {
      payload.students = Array.from(
        new Set((dto.students ?? []).map(studentId => this.toObjectId(studentId)!.toString())),
      ).map(studentId => new Types.ObjectId(studentId));
    }

    return payload;
  }

  private getSort(query: CoursesListQueryDto) {
    const sortBy = query.sortBy && ['name', 'price', 'createdAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  async addManyStudentsToCourse(courseId: string, studentIds: string[]) {
    const course = await this.findDocumentById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const normalizedIds = Array.from(
      new Set(
        (studentIds ?? [])
          .filter(studentId => Types.ObjectId.isValid(studentId))
          .map(studentId => String(studentId)),
      ),
    );

    const currentIds = (course.students ?? []).map(studentId => String(studentId));
    const nextIds = normalizedIds.filter(studentId => !currentIds.includes(studentId));

    if (nextIds.length > 0) {
      course.students ??= [];
      course.students.push(...nextIds.map(studentId => new Types.ObjectId(studentId)));
      await course.save();
    }

    return this.findOne(courseId);
  }

  async create(createCourseDto: CreateCourseDto) {
    const createdCourse = await this.courseModel.create(this.normalizePayload(createCourseDto));
    return this.findOne(String(createdCourse._id));
  }

  async findAll(query: CoursesListQueryDto = {}) {
    const filter: FilterQuery<CourseDocument> = {};

    if (query.teacherId) {
      filter.teacherId = this.toObjectId(query.teacherId);
    }

    if (query.studentId) {
      filter.students = this.toObjectId(query.studentId);
    }

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const courses = await this.courseModel
      .find(filter)
      .populate(this.coursePopulate)
      .sort(this.getSort(query))
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return serializeResources(courses);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid course ID');
    }

    const course = await this.courseModel.findById(id).populate(this.coursePopulate).exec();
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return serializeResource(course);
  }

  async update(id: string, updateCourseDto: UpdateCourseDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid course ID');
    }

    const updatedCourse = await this.courseModel
      .findByIdAndUpdate(id, this.normalizePayload(updateCourseDto), { new: true })
      .exec();

    if (!updatedCourse) {
      throw new NotFoundException('Course not found');
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid course ID');
    }

    const result = await this.courseModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Course not found');
    }

    return true;
  }
}
