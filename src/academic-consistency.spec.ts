import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { AttendanceService } from './attendance/attendance.service';
import { GradesService } from './grades/grades.service';
import { HomeworkService } from './homework/homework.service';
import { ScheduleService } from './schedule/schedule.service';
import { Role } from './roles/roles.enum';
import { mapGradeResponse } from './grades/dto/grade-response.dto';

function objectId() {
  return new Types.ObjectId().toString();
}

function chain<T>(result: T) {
  const query: Record<string, jest.Mock> = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn(async () => result),
  };
  return query;
}

describe('academic domain consistency', () => {
  it('teacher cannot access attendance for outside students', async () => {
    const studentId = objectId();
    const service = new AttendanceService(
      {} as any,
      { findById: jest.fn(() => chain({ _id: studentId, role: Role.Student, branchIds: ['branch-a'] })) } as any,
      { find: jest.fn(() => chain([])) } as any,
      { find: jest.fn(() => chain([])) } as any,
    );

    await expect(
      service.getByUserForActor(studentId, { userId: objectId(), role: Role.Teacher, branchIds: ['branch-a'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('student cannot access another student homework', async () => {
    const studentId = objectId();
    const service = new HomeworkService(
      {} as any,
      { findById: jest.fn(() => chain({ _id: studentId, role: Role.Student, branchIds: ['branch-a'] })) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getByUserForActor(studentId, { userId: objectId(), role: Role.Student, branchIds: ['branch-a'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('branch admin cannot access another branch grades', async () => {
    const studentId = objectId();
    const service = new GradesService(
      {} as any,
      { findById: jest.fn(() => chain({ _id: studentId, role: Role.Student, branchIds: ['branch-b'] })) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getByUserForActor(studentId, { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('branch admin cannot read schedule with outside assigned students', async () => {
    const scheduleId = objectId();
    const teacherId = objectId();
    const studentId = objectId();
    const service = new ScheduleService(
      {
        findById: jest.fn(() => chain({
          _id: scheduleId,
          teacher: { id: teacherId },
          students: [{ id: studentId }],
        })),
      } as any,
      {} as any,
      {} as any,
      {
        findById: jest.fn(() => chain({ _id: teacherId, branchIds: ['branch-a'] })),
        find: jest.fn(() => chain([{ _id: studentId, branchIds: ['branch-b'] }])),
      } as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.findOneForActor(scheduleId, { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('schedule rejects branch admin group assignment outside scope', async () => {
    const teacherId = objectId();
    const groupId = objectId();
    const outsideStudentId = objectId();
    const service = new ScheduleService(
      {} as any,
      {} as any,
      {} as any,
      {
        findById: jest.fn(() => chain({ _id: teacherId, branchIds: ['branch-a'] })),
        find: jest.fn(() => chain([
          { _id: teacherId, branchIds: ['branch-a'] },
          { _id: outsideStudentId, branchIds: ['branch-b'] },
        ])),
      } as any,
      {
        findById: jest.fn(() => chain({
          _id: groupId,
          teacher: teacherId,
          students: [outsideStudentId],
        })),
      } as any,
      {} as any,
    );

    await expect(
      service.createForActor(
        {
          course: objectId(),
          room: objectId(),
          date: '2026-05-04',
          timeStart: '2026-05-04T09:00:00.000Z',
          timeEnd: '2026-05-04T10:00:00.000Z',
          teacher: teacherId,
          group: groupId,
        },
        { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('academic response mapper removes private and internal fields', () => {
    const response = mapGradeResponse({
      _id: objectId(),
      user: {
        _id: objectId(),
        username: 'student',
        firstName: 'Student',
        role: Role.Student,
        email: 'student@example.com',
        phoneNumber: '+100000',
        password: 'hash',
      },
      subject: 'Math',
      score: 95,
      __v: 0,
    });

    expect(response).toMatchObject({
      id: expect.any(String),
      user: {
        id: expect.any(String),
        fullName: 'Student',
        role: Role.Student,
      },
      subject: 'Math',
      score: 95,
    });
    expect(JSON.stringify(response)).not.toContain('_id');
    expect(JSON.stringify(response)).not.toContain('email');
    expect(JSON.stringify(response)).not.toContain('phoneNumber');
    expect(JSON.stringify(response)).not.toContain('password');
  });
});
