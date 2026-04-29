import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Grade, GradeDocument } from './schemas/grade.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../roles/roles.enum';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';

@Injectable()
export class GradesService {
  constructor(
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
  ) {}

  private normalizeBranchIds(branchIds?: string[]): string[] {
    return [...new Set((branchIds ?? [])
      .filter((branchId): branchId is string => typeof branchId === 'string')
      .map(branchId => branchId.trim())
      .filter(branchId => branchId.length > 0))];
  }

  private isSystemWideRole(role?: Role): boolean {
    return role === Role.Owner || role === Role.Extra;
  }

  private isBranchAdminRole(role?: Role): boolean {
    return role === Role.Admin;
  }

  private ensureScopedActorHasBranches(actor: AuthenticatedUser): string[] {
    const branchIds = this.normalizeBranchIds(actor.branchIds);
    if (!this.isSystemWideRole(actor.role) && branchIds.length === 0) {
      throw new ForbiddenException('User has no assigned branch scope');
    }

    return branchIds;
  }

  private async getTeacherVisibleStudentIds(teacherId: string): Promise<string[]> {
    const [courses, groups, schedules] = await Promise.all([
      this.courseModel.find({ teacherId }, { students: 1 }).lean().exec(),
      this.groupModel.find({ teacher: teacherId }, { students: 1 }).lean().exec(),
      this.scheduleModel.find({ teacher: teacherId }, { students: 1 }).lean().exec(),
    ]);

    const studentIds = new Set<string>();
    for (const collection of [courses, groups, schedules]) {
      for (const item of collection) {
        const students = Array.isArray(item.students) ? item.students : [];
        for (const studentId of students) {
          studentIds.add(String(studentId));
        }
      }
    }

    return [...studentIds];
  }

  private async assertActorCanAccessStudent(actor: AuthenticatedUser, userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Student not found');
    }

    if (user.role !== Role.Student) {
      throw new BadRequestException('Grades can only be accessed for students');
    }

    if (this.isSystemWideRole(actor.role)) {
      return user;
    }

    if (actor.role === Role.Student) {
      if (actor.userId === String(user._id)) {
        return user;
      }

      throw new ForbiddenException('Students can only access their own grades');
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const studentBranches = this.normalizeBranchIds(user.branchIds);
      if (studentBranches.some(branchId => actorBranches.includes(branchId))) {
        return user;
      }

      throw new NotFoundException('Student not found');
    }

    if (actor.role === Role.Teacher) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(actor.userId);
      if (visibleStudentIds.includes(String(user._id))) {
        return user;
      }

      throw new ForbiddenException('Teachers can access grades only for their assigned students');
    }

    throw new ForbiddenException('No access to grades');
  }

  async getByUser(userId: string) {
    const grades = await this.gradeModel.find({ user: userId }).sort({ date: -1 }).exec();
    return serializeResources(grades);
  }

  async getByUserForActor(userId: string, actor: AuthenticatedUser) {
    await this.assertActorCanAccessStudent(actor, userId);
    return this.getByUser(userId);
  }

  async add(userId: string, subject: string, score: number) {
    const entry = new this.gradeModel({
      user: new Types.ObjectId(userId),
      subject,
      score,
      date: new Date(),
    });
    return serializeResource(await entry.save());
  }

  async addForActor(userId: string, subject: string, score: number, actor: AuthenticatedUser) {
    await this.assertActorCanAccessStudent(actor, userId);
    return this.add(userId, subject, score);
  }

  async update(id: string, score: number) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid grade ID');
    }

    const grade = await this.gradeModel.findByIdAndUpdate(id, { score }, { new: true }).exec();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    return serializeResource(grade);
  }

  async updateForActor(id: string, score: number, actor: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid grade ID');
    }

    const grade = await this.gradeModel.findById(id).lean().exec();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    await this.assertActorCanAccessStudent(actor, String(grade.user));

    return this.update(id, score);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid grade ID');
    }

    const grade = await this.gradeModel.findByIdAndDelete(id).exec();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    return serializeResource(grade);
  }

  async removeForActor(id: string, actor: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid grade ID');
    }

    const grade = await this.gradeModel.findById(id).lean().exec();
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }

    await this.assertActorCanAccessStudent(actor, String(grade.user));

    return this.remove(id);
  }
}
