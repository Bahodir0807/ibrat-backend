import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
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
    const [groups, schedules] = await Promise.all([
      this.groupModel.find({ teacher: teacherId }, { students: 1 }).lean().exec(),
      this.scheduleModel.find({ teacher: teacherId }, { students: 1 }).lean().exec(),
    ]);

    const studentIds = new Set<string>();
    for (const collection of [groups, schedules]) {
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
    const student = await this.userModel.findById(userId).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.role !== Role.Student) {
      throw new BadRequestException('Attendance can only be accessed for students');
    }

    if (this.isSystemWideRole(actor.role)) {
      return student;
    }

    if (actor.role === Role.Student) {
      if (actor.userId === String(student._id)) {
        return student;
      }

      throw new ForbiddenException('Students can only access their own attendance');
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const studentBranches = this.normalizeBranchIds(student.branchIds);
      if (studentBranches.some(branchId => actorBranches.includes(branchId))) {
        return student;
      }

      throw new NotFoundException('Student not found');
    }

    if (actor.role === Role.Teacher) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(actor.userId);
      if (visibleStudentIds.includes(String(student._id))) {
        return student;
      }

      throw new ForbiddenException('Teachers can access attendance only for their assigned students');
    }

    throw new ForbiddenException('No access to attendance');
  }

  private getDayRange(value: Date) {
    const start = new Date(value);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(value);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  private async ensureStudentIsEnrolled(
    schedule: ScheduleDocument,
    userId: string,
  ): Promise<void> {
    const inScheduleStudents = Array.isArray(schedule.students)
      && schedule.students.some(studentId => String(studentId) === userId);

    if (inScheduleStudents) {
      return;
    }

    if (!schedule.group) {
      throw new BadRequestException('Student is not assigned to this schedule');
    }

    const group = await this.groupModel.findById(schedule.group).lean().exec();
    const inGroup = Array.isArray(group?.students)
      && group.students.some(studentId => String(studentId) === userId);

    if (!inGroup) {
      throw new BadRequestException('Student is not enrolled in the scheduled group');
    }
  }

  private async resolveSchedule(body: MarkAttendanceDto): Promise<ScheduleDocument> {
    if (body.scheduleId) {
      const schedule = await this.scheduleModel.findById(body.scheduleId).exec();
      if (!schedule) {
        throw new NotFoundException('Schedule not found');
      }

      return schedule;
    }

    const attendanceDate = new Date(body.date);
    const { start, end } = this.getDayRange(attendanceDate);
    const groupIds = await this.groupModel
      .find({ students: new Types.ObjectId(body.userId) }, { _id: 1 })
      .lean()
      .exec();

    const schedules = await this.scheduleModel
      .find({
        date: { $gte: start, $lte: end },
        $or: [
          { students: new Types.ObjectId(body.userId) },
          ...(groupIds.length > 0 ? [{ group: { $in: groupIds.map(group => group._id) } }] : []),
        ],
      })
      .sort({ timeStart: 1 })
      .exec();

    if (schedules.length === 0) {
      throw new BadRequestException('No schedule found for the student on the selected date');
    }

    if (schedules.length > 1) {
      throw new BadRequestException('Multiple lessons found for the selected date, scheduleId is required');
    }

    return schedules[0];
  }

  async getByUser(userId: string) {
    const attendance = await this.attendanceModel
      .find({ user: userId })
      .populate({ path: 'schedule', select: 'date timeStart timeEnd course room teacher group' })
      .sort({ date: -1 })
      .exec();
    return serializeResources(attendance);
  }

  async getByUserForActor(userId: string, actor: AuthenticatedUser) {
    await this.assertActorCanAccessStudent(actor, userId);
    return this.getByUser(userId);
  }

  async markAttendance(
    body: MarkAttendanceDto,
    actor?: AuthenticatedUser,
  ) {
    if (!body.userId || !body.date) {
      throw new BadRequestException('Invalid attendance payload');
    }

    await this.assertActorCanAccessStudent(actor as AuthenticatedUser, body.userId);

    const schedule = await this.resolveSchedule(body);
    await this.ensureStudentIsEnrolled(schedule, body.userId);

    if (actor?.role === Role.Teacher && String(schedule.teacher) !== actor.userId) {
      throw new ForbiddenException('Teachers can mark attendance only for their own schedule');
    }

    const attendance = await this.attendanceModel
      .findOneAndUpdate(
        { user: body.userId, schedule: schedule._id },
        {
          $set: {
            status: body.status,
            date: new Date(body.date),
            schedule: schedule._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .populate({ path: 'schedule', select: 'date timeStart timeEnd course room teacher group' })
      .exec();

    return serializeResource(attendance);
  }
}
