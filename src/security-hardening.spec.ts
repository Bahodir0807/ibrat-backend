import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { CoursesService } from './courses/courses.service';
import { GroupsService } from './groups/groups.service';
import { NotificationsService } from './notifications/notifications.service';
import { Role } from './roles/roles.enum';
import { UsersService } from './users/users.service';
import { UserStatus } from './users/user-status.enum';
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

describe('security hardening', () => {
  describe('courses', () => {
    it('allows admin to read courses only within branch scope', async () => {
      const courseId = objectId();
      const teacherId = objectId();
      const studentId = objectId();
      const actor = {
        userId: objectId(),
        role: Role.Admin,
        branchIds: ['branch-a'],
      };
      const course = { _id: courseId, teacherId, students: [studentId] };
      const relatedUsers = [{ _id: teacherId, branchIds: ['branch-a'] }];
      const relatedStudents = [{ _id: studentId, branchIds: ['branch-a'] }];

      const courseModel = {
        findById: jest.fn(() => chain(course)),
      };
      const userModel = {
        find: jest.fn(() => chain(relatedUsers)),
      };
      const studentModel = {
        find: jest.fn(() => chain(relatedStudents)),
      };
      const service = new CoursesService(
        courseModel as any,
        userModel as any,
        {} as any,
        {} as any,
        {} as any,
        studentModel as any,
      );

      await expect(
        service.findOneForActor(courseId, actor),
      ).resolves.toMatchObject({
        id: courseId,
        students: [],
      });
    });

    it('applies branch filters for admin course lists', async () => {
      const scopedUserId = objectId();
      let courseFindFilter: unknown;
      const userModel = {
        find: jest.fn(() => chain([{ _id: scopedUserId }])),
      };
      const courseModel = {
        find: jest.fn((filter) => {
          courseFindFilter = filter;
          return chain([]);
        }),
        countDocuments: jest.fn(() => chain(0)),
      };
      const service = new CoursesService(
        courseModel as any,
        userModel as any,
        {} as any,
        {} as any,
        {} as any,
        { find: jest.fn(() => chain([{ _id: scopedUserId }])) } as any,
      );

      await service.findAllForActor(
        {},
        { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] },
      );

      expect(courseFindFilter).toHaveProperty('$and');
    });

    it('rejects teacher assignment of students outside their own groups', async () => {
      const teacherId = objectId();
      const outsideStudentId = objectId();
      const groupModel = {
        find: jest.fn(() => chain([])),
      };
      const service = new CoursesService(
        {} as any,
        {} as any,
        groupModel as any,
        {} as any,
        {} as any,
      );

      await expect(
        service.createForActor(
          { name: 'Course', price: 100, students: [outsideStudentId] },
          { userId: teacherId, role: Role.Teacher, branchIds: ['branch-a'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('groups', () => {
    it('rejects admin group reads outside branch scope', async () => {
      const groupId = objectId();
      const teacherId = objectId();
      const studentId = objectId();
      const actor = {
        userId: objectId(),
        role: Role.Admin,
        branchIds: ['branch-a'],
      };
      const group = { _id: groupId, teacher: teacherId, students: [studentId] };
      const relatedUsers = [{ _id: teacherId, branchIds: ['branch-a'] }];
      const relatedStudents = [{ _id: studentId, branchIds: ['branch-b'] }];
      const groupModel = {
        findById: jest.fn(() => chain(group)),
      };
      const userModel = {
        find: jest.fn(() => chain(relatedUsers)),
      };
      const studentModel = {
        find: jest.fn(() => chain(relatedStudents)),
      };
      const service = new GroupsService(
        groupModel as any,
        {} as any,
        userModel as any,
        {} as any,
        studentModel as any,
      );

      await expect(
        service.findOneForActor(groupId, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('applies branch filters for admin group lists', async () => {
      const scopedUserId = objectId();
      let groupFindFilter: unknown;
      const userModel = {
        find: jest.fn(() => chain([{ _id: scopedUserId }])),
      };
      const groupModel = {
        find: jest.fn((filter) => {
          groupFindFilter = filter;
          return chain([]);
        }),
        countDocuments: jest.fn(() => chain(0)),
      };
      const service = new GroupsService(
        groupModel as any,
        {} as any,
        userModel as any,
        {} as any,
        { find: jest.fn(() => chain([{ _id: scopedUserId }])) } as any,
      );

      await service.findAllForActor(
        {},
        { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] },
      );

      expect(groupFindFilter).toHaveProperty('$and');
    });

    it('rejects teacher assignment of students outside their own groups on create', async () => {
      const teacherId = objectId();
      const outsideStudentId = objectId();
      const groupModel = {
        find: jest.fn(() => chain([])),
      };
      const service = new GroupsService(
        groupModel as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(
        service.createForActor(
          {
            name: 'Group',
            course: objectId(),
            teacher: teacherId,
            students: [outsideStudentId],
          },
          { userId: teacherId, role: Role.Teacher, branchIds: ['branch-a'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('notifications', () => {
    it('uses actor-scoped lookup for manual notification recipients', async () => {
      const usersService = {
        findNotificationRecipientForActor: jest.fn(async () => {
          throw new NotFoundException('User not found');
        }),
      };
      const telegramService = {
        sendMessage: jest.fn(),
      };
      const service = new NotificationsService(
        usersService as any,
        telegramService as any,
      );

      await expect(
        service.sendManualNotification(
          {
            userId: objectId(),
            message: 'hello',
            type: NotificationType.GENERAL,
          },
          { userId: objectId(), role: Role.Admin, branchIds: ['branch-a'] },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(telegramService.sendMessage).not.toHaveBeenCalled();
      expect(usersService.findNotificationRecipientForActor).toHaveBeenCalled();
    });

    it('uses actor-scoped recipient lists for role notifications', async () => {
      const usersService = {
        findByRoleForActor: jest.fn(async () => [
          {
            id: objectId(),
            username: 'student',
            role: Role.Student,
            telegramId: '123',
          },
        ]),
      };
      const telegramService = {
        sendMessage: jest.fn(),
      };
      const service = new NotificationsService(
        usersService as any,
        telegramService as any,
      );
      const actor = {
        userId: objectId(),
        role: Role.Admin,
        branchIds: ['branch-a'],
      };

      await service.sendRoleNotification(
        NotificationType.GENERAL,
        Role.Student,
        'hello',
        actor,
      );

      expect(usersService.findByRoleForActor).toHaveBeenCalledWith(
        Role.Student,
        actor,
      );
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        '123',
        '[Notice] hello',
      );
    });
  });

  describe('public user sanitizer', () => {
    it('keeps admin user reads free of student-specific profile fields', async () => {
      const userId = objectId();
      const userModel = {
        findById: jest.fn(() =>
          chain({
            _id: userId,
            toObject: () => ({
              _id: userId,
              username: 'student',
              email: 'student@example.com',
              phoneNumber: '+100000000',
              role: Role.Student,
              status: UserStatus.Active,
              isActive: true,
              branchIds: ['branch-a'],
              studentYear: 'legacy',
              paymentMethod: 'cash',
              contactOwner: 'parent',
            }),
          }),
        ),
      };
      const service = new UsersService(
        userModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.findById(userId);

      expect(result).toHaveProperty('email', 'student@example.com');
      expect(result).toHaveProperty('phoneNumber', '+100000000');
      expect(result).not.toHaveProperty('studentYear');
      expect(result).not.toHaveProperty('paymentMethod');
      expect(result).not.toHaveProperty('contactOwner');
      expect(result).toMatchObject({
        id: userId,
        username: 'student',
        role: Role.Student,
      });
    });

    it('returns compact public user shape for scoped self reads', async () => {
      const studentId = objectId();
      const usersRepository = {
        findById: jest.fn(() =>
          chain({
            _id: studentId,
            role: Role.Student,
            branchIds: ['branch-a'],
            toObject: () => ({
              _id: studentId,
              username: 'student',
              firstName: 'Student',
              lastName: 'One',
              role: Role.Student,
              telegramId: '123',
              email: 'student@example.com',
              phoneNumber: '+100000000',
              branchIds: ['branch-a'],
              status: UserStatus.Active,
              isActive: true,
            }),
          }),
        ),
      };
      const service = new UsersService(
        usersRepository as any,
        {} as any,
        { find: jest.fn(() => chain([{ students: [studentId] }])) } as any,
        { find: jest.fn(() => chain([])) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.findByIdForActor(studentId, {
        userId: studentId,
        role: Role.Student,
        branchIds: ['branch-a'],
      });

      expect(result).toEqual({
        id: studentId,
        fullName: 'Student One',
        role: Role.Student,
      });
      expect(result).not.toHaveProperty('telegramId');
      expect(result).not.toHaveProperty('branchIds');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phoneNumber');
    });
  });
});
