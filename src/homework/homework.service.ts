import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Homework, HomeworkDocument } from './schemas/homework.schema';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../roles/roles.enum';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';

@Injectable()
export class HomeworkService {
  constructor(
    @InjectModel(Homework.name) private readonly hwModel: Model<HomeworkDocument>,
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
      throw new BadRequestException('Homework can only be accessed for students');
    }

    if (this.isSystemWideRole(actor.role)) {
      return user;
    }

    if (actor.role === Role.Student) {
      if (actor.userId === String(user._id)) {
        return user;
      }

      throw new ForbiddenException('Students can only access their own homework');
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

      throw new ForbiddenException('Teachers can access homework only for their assigned students');
    }

    throw new ForbiddenException('No access to homework');
  }

  async getByUser(userId: string) {
    const homework = await this.hwModel.find({ user: userId }).sort({ date: -1 }).exec();
    return serializeResources(homework);
  }

  async getByUserForActor(userId: string, actor: AuthenticatedUser) {
    await this.assertActorCanAccessStudent(actor, userId);
    return this.getByUser(userId);
  }

  async create(dto: CreateHomeworkDto) {
    const entry = new this.hwModel({
      user: new Types.ObjectId(dto.userId),
      date: new Date(dto.date),
      tasks: dto.tasks,
    });
    return serializeResource(await entry.save());
  }

  async createForActor(dto: CreateHomeworkDto, actor: AuthenticatedUser) {
    await this.assertActorCanAccessStudent(actor, dto.userId);
    return this.create(dto);
  }

  async markComplete(id: string, actor?: { userId: string; role: string }) {
    const homework = await this.hwModel.findById(id).exec();
    if (!homework) {
      throw new NotFoundException('Homework not found');
    }

    if (actor?.role === 'student' && String(homework.user) !== actor.userId) {
      throw new ForbiddenException('Students can complete only their own homework');
    }

    homework.completed = true;
    await homework.save();
    return serializeResource(homework);
  }

  async markCompleteForActor(id: string, actor: AuthenticatedUser) {
    const homework = await this.hwModel.findById(id).exec();
    if (!homework) {
      throw new NotFoundException('Homework not found');
    }

    await this.assertActorCanAccessStudent(actor, String(homework.user));

    homework.completed = true;
    await homework.save();
    return serializeResource(homework);
  }
}
