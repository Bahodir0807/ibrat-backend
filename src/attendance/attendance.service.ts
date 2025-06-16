import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  async getByUser(userId: string) {
    return this.attendanceModel.find({ user: userId }).exec();
  }

  async mark(userId: string, date: string, status: 'present' | 'absent') {
    return this.attendanceModel.updateOne(
      { user: userId, date: new Date(date) },
      { $set: { status } },
      { upsert: true },
    );
  }
}
