import { Types } from 'mongoose';
import { GroupsService } from './groups.service';
import { Role } from '../roles/roles.enum';

const chain = <T>(value: T) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

const groupQuery = <T>(value: T) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

function groupDoc(overrides: Record<string, unknown> = {}) {
  const data = {
    _id: new Types.ObjectId(),
    name: 'Group A',
    course: new Types.ObjectId(),
    teacher: new Types.ObjectId(),
    students: [],
    ...overrides,
  };

  return {
    ...data,
    toObject: jest.fn(() => data),
  };
}

function createService() {
  const groupsRepository = {
    find: jest.fn(() => groupQuery([])),
    findById: jest.fn(() => groupQuery(groupDoc())),
    countDocuments: jest.fn(() => chain(0)),
    updateById: jest.fn(() => chain(groupDoc())),
    create: jest.fn(),
    deleteById: jest.fn(),
  };
  const courseModel = {
    findById: jest.fn(() => chain(null)),
  };
  const userModel = {
    find: jest.fn(() => chain([])),
    findById: jest.fn(() => chain(null)),
  };
  const scheduleModel = {
    exists: jest.fn(() => chain(null)),
  };

  const service = new GroupsService(
    groupsRepository as never,
    courseModel as never,
    userModel as never,
    scheduleModel as never,
  );

  return { service, groupsRepository, courseModel, userModel };
}

describe('GroupsService student roster updates', () => {
  it('deduplicates students before updating a group', async () => {
    const { service, groupsRepository, userModel } = createService();
    const groupId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();

    userModel.find.mockReturnValueOnce(
      chain([{ _id: studentId, role: Role.Student }]),
    );
    groupsRepository.updateById.mockReturnValueOnce(
      chain(groupDoc({ _id: groupId, students: [new Types.ObjectId(studentId)] })),
    );
    groupsRepository.findById.mockReturnValueOnce(
      groupQuery(groupDoc({ _id: groupId, students: [new Types.ObjectId(studentId)] })),
    );

    await service.update(groupId, {
      students: [studentId, studentId],
    });

    const updateCall = groupsRepository.updateById.mock.calls[0] as unknown[];
    const payload = updateCall[1] as {
      students: Types.ObjectId[];
    };
    expect(payload.students).toHaveLength(1);
    expect(String(payload.students[0])).toBe(studentId);
  });

  it('populates course teacherIds for multi-teacher group labels', async () => {
    const { service, groupsRepository } = createService();
    const query = groupQuery([]);
    groupsRepository.find.mockReturnValueOnce(query);

    await service.findAll();

    expect(query.populate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'course',
          populate: expect.arrayContaining([
            expect.objectContaining({ path: 'teacherIds' }),
          ]),
        }),
      ]),
    );
  });
});
