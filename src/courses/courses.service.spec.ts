import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CoursesService } from './courses.service';
import { Role } from '../roles/roles.enum';

const objectId = () => new Types.ObjectId().toHexString();

const chain = <T>(value: T) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
});

describe('CoursesService multi-teacher support', () => {
  function createService(
    overrides: {
      coursesRepository?: Record<string, unknown>;
      userModel?: Record<string, unknown>;
    } = {},
  ) {
    const coursesRepository = {
      create: jest.fn(async (payload) => ({ _id: objectId(), ...payload })),
      findById: jest.fn(() =>
        chain({
          _id: objectId(),
          name: 'Math',
          price: 100,
          teacherIds: [],
          students: [],
        }),
      ),
      find: jest.fn(() => chain([])),
      countDocuments: jest.fn(() => chain(0)),
      updateById: jest.fn(() => chain({ _id: objectId() })),
      deleteById: jest.fn(() => chain({ _id: objectId() })),
      exists: jest.fn(() => chain(null)),
      ...overrides.coursesRepository,
    };
    const userModel = {
      find: jest.fn(() => chain([])),
      findById: jest.fn(() => chain(null)),
      ...overrides.userModel,
    };

    const service = new CoursesService(
      coursesRepository as never,
      userModel as never,
      { find: jest.fn(() => chain([])) } as never,
      { exists: jest.fn(() => chain(null)) } as never,
      { exists: jest.fn(() => chain(null)) } as never,
    );

    return { service, coursesRepository, userModel };
  }

  it('normalizes duplicate teacherIds before create', async () => {
    const teacherId = objectId();
    const { service, coursesRepository, userModel } = createService({
      userModel: {
        find: jest.fn(() => chain([{ _id: teacherId, role: Role.Teacher }])),
      },
    });

    await service.create({
      name: 'Math',
      price: 100,
      teacherIds: [teacherId, teacherId],
    });

    expect(userModel.find).toHaveBeenCalledWith({
      _id: { $in: [expect.any(Types.ObjectId)] },
    });
    expect(coursesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherIds: [expect.any(Types.ObjectId)],
      }),
    );
  });

  it('rejects non-teacher users in teacherIds', async () => {
    const teacherId = objectId();
    const { service } = createService({
      userModel: {
        find: jest.fn(() => chain([{ _id: teacherId, role: Role.Student }])),
      },
    });

    await expect(
      service.create({
        name: 'Math',
        price: 100,
        teacherIds: [teacherId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes teacher course list by teacherIds containment', async () => {
    const teacherId = objectId();
    let filter: unknown;
    const { service } = createService({
      coursesRepository: {
        find: jest.fn((input) => {
          filter = input;
          return chain([]);
        }),
      },
    });

    await service.findAllForActor(
      { teacherId: objectId() },
      { userId: teacherId, role: Role.Teacher, branchIds: [] },
    );

    expect(filter).toMatchObject({ teacherIds: expect.any(Types.ObjectId) });
    expect(String((filter as { teacherIds: Types.ObjectId }).teacherIds)).toBe(
      teacherId,
    );
  });

  it('prevents a teacher from creating a course without themselves assigned', async () => {
    const teacherId = objectId();
    const otherTeacherId = objectId();
    const { service } = createService();

    await expect(
      service.createForActor(
        { name: 'Math', price: 100, teacherIds: [otherTeacherId] },
        { userId: teacherId, role: Role.Teacher, branchIds: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
