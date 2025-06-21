import { BadRequestException, Body, Injectable } from '@nestjs/common';
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

  async markAttendance(
    @Body() body: { userId: string; date: string; status: 'present' | 'absent' },
  ) {
    if (!body.userId || !body.date || !['present', 'absent'].includes(body.status)) {
      throw new BadRequestException('Некорректные данные');
    }
    return this.attendanceModel.updateOne(
      { user: body.userId, date: new Date(body.date) },
      { $set: { status: body.status } },
      { upsert: true },
    );
  }
  
}
