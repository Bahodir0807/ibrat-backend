import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  async getByUser(userId: string) {
    const attendance = await this.attendanceModel.find({ user: userId }).sort({ date: -1 }).exec();
    return serializeResources(attendance);
  }

  async markAttendance(body: MarkAttendanceDto) {
    if (!body.userId || !body.date) {
      throw new BadRequestException('Invalid attendance payload');
    }

    const attendance = await this.attendanceModel
      .findOneAndUpdate(
        { user: body.userId, date: new Date(body.date) },
        { $set: { status: body.status } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return serializeResource(attendance);
  }
}
