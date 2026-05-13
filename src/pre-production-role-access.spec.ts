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

  it('student group list is scoped to own membership', async () => {
    const studentId = objectId();
    let groupFindFilter: unknown;
    const groupsRepository = {
      find: jest.fn((filter) => {
        groupFindFilter = filter;
        return chain([]);
      }),
      countDocuments: jest.fn(() => chain(0)),
    };
    const service = new GroupsService(
      groupsRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAllForActor(
      { teacherId: objectId(), studentId: objectId() },
      { userId: studentId, role: Role.Student, branchIds: ['branch-a'] },
    );

    expect(groupFindFilter).toMatchObject({
      students: expect.any(Types.ObjectId),
    });
    expect(
      String((groupFindFilter as { students: Types.ObjectId }).students),
    ).toBe(studentId);
  });

  it('teacher group list is scoped to own teacher id', async () => {
    const teacherId = objectId();
    let groupFindFilter: unknown;
    const groupsRepository = {
      find: jest.fn((filter) => {
        groupFindFilter = filter;
        return chain([]);
      }),
      countDocuments: jest.fn(() => chain(0)),
    };
    const service = new GroupsService(
      groupsRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAllForActor(
      { teacherId: objectId(), studentId: objectId() },
      { userId: teacherId, role: Role.Teacher, branchIds: ['branch-a'] },
    );

    expect(groupFindFilter).toMatchObject({
      teacher: expect.any(Types.ObjectId),
    });
    expect(
      String((groupFindFilter as { teacher: Types.ObjectId }).teacher),
    ).toBe(teacherId);
  });

  it('student cannot read unrelated group by id', async () => {
    const studentA = objectId();
    const studentB = objectId();
    const teacherB = objectId();
    const groupId = objectId();
    const groupsRepository = {
      findById: jest.fn(() =>
        chain({
          _id: groupId,
          name: 'Teacher B group',
          teacher: { _id: teacherB, username: 'teacher-b', role: Role.Teacher },
          students: [
            { _id: studentB, username: 'student-b', role: Role.Student },
          ],
        }),
      ),
    };
    const service = new GroupsService(
      groupsRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.findOneForActor(groupId, {
        userId: studentA,
        role: Role.Student,
        branchIds: ['branch-a'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('teacher cannot read unrelated group by id', async () => {
    const teacherA = objectId();
    const teacherB = objectId();
    const studentB = objectId();
    const groupId = objectId();
    const groupsRepository = {
      findById: jest.fn(() =>
        chain({
          _id: groupId,
          name: 'Teacher B group',
          teacher: { _id: teacherB, username: 'teacher-b', role: Role.Teacher },
          students: [
            { _id: studentB, username: 'student-b', role: Role.Student },
          ],
        }),
      ),
    };
    const service = new GroupsService(
      groupsRepository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.findOneForActor(groupId, {
        userId: teacherA,
        role: Role.Teacher,
        branchIds: ['branch-a'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([Role.Admin, Role.Owner, Role.Extra])(
    '%s can list all groups',
    async (role) => {
      let groupFindFilter: unknown;
      const groupsRepository = {
        find: jest.fn((filter) => {
          groupFindFilter = filter;
          return chain([]);
        }),
        countDocuments: jest.fn(() => chain(0)),
      };
      const service = new GroupsService(
        groupsRepository as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await service.findAllForActor(
        {},
        { userId: objectId(), role, branchIds: ['branch-a'] },
      );

      expect(groupFindFilter).toEqual({});
    },
  );

  it('student course list is scoped to own enrollment', async () => {
    const studentId = objectId();
    let courseFindFilter: unknown;
    const coursesRepository = {
      find: jest.fn((filter) => {
        courseFindFilter = filter;
        return chain([]);
      }),
      countDocuments: jest.fn(() => chain(0)),
    };
    const service = new CoursesService(
      coursesRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAllForActor(
      { teacherId: objectId(), studentId: objectId() },
      { userId: studentId, role: Role.Student, branchIds: ['branch-a'] },
    );

    expect(courseFindFilter).toMatchObject({
      students: expect.any(Types.ObjectId),
    });
    expect(
      String((courseFindFilter as { students: Types.ObjectId }).students),
    ).toBe(studentId);
  });

  it('teacher course list is scoped to own teacher id', async () => {
    const teacherId = objectId();
    let courseFindFilter: unknown;
    const coursesRepository = {
      find: jest.fn((filter) => {
        courseFindFilter = filter;
        return chain([]);
      }),
      countDocuments: jest.fn(() => chain(0)),
    };
    const service = new CoursesService(
      coursesRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.findAllForActor(
      { teacherId: objectId(), studentId: objectId() },
      { userId: teacherId, role: Role.Teacher, branchIds: ['branch-a'] },
    );

    expect(courseFindFilter).toMatchObject({
      teacherIds: expect.any(Types.ObjectId),
    });
    expect(
      String((courseFindFilter as { teacherIds: Types.ObjectId }).teacherIds),
    ).toBe(teacherId);
  });
});
