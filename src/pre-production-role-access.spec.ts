import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { CoursesService } from './courses/courses.service';
import { GroupsService } from './groups/groups.service';
import { HomeworkService } from './homework/homework.service';
import { NotificationsService } from './notifications/notifications.service';
import { Role } from './roles/roles.enum';
import { ScheduleService } from './schedule/schedule.service';
import { NotificationType } from './notifications/notification-type.enum';

function objectId() {
  return new Types.ObjectId().toString();
}

describe('pre-production role access rules', () => {
  const teacherActor = {
    userId: objectId(),
    role: Role.Teacher,
    branchIds: ['branch-a'],
  };

  it('teacher cannot mutate courses', async () => {
    const service = new CoursesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createForActor({ name: 'IELTS', price: 100 }, teacherActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('teacher cannot mutate groups', async () => {
    const service = new GroupsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createForActor(
        { name: 'Group A', course: objectId(), teacher: teacherActor.userId },
        teacherActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('teacher cannot mutate schedule', async () => {
    const service = new ScheduleService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createForActor(
        {
          course: objectId(),
          room: objectId(),
          date: '2026-05-06',
          timeStart: '2026-05-06T09:00:00.000Z',
          timeEnd: '2026-05-06T10:00:00.000Z',
          teacher: teacherActor.userId,
        },
        teacherActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('student cannot mutate homework completion state', async () => {
    const service = new HomeworkService(
      { findById: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.markCompleteForActor(objectId(), {
        userId: objectId(),
        role: Role.Student,
        branchIds: ['branch-a'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('teacher cannot send notifications', async () => {
    const service = new NotificationsService(
      { findNotificationRecipientForActor: jest.fn() } as any,
      { sendMessage: jest.fn() } as any,
    );

    await expect(
      service.sendManualNotification(
        {
          userId: objectId(),
          type: NotificationType.GENERAL,
          message: 'Reminder',
        },
        teacherActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
