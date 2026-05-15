import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { Role } from '../roles/roles.enum';
import { UserStatus } from './user-status.enum';
import { StudentPaymentMethod } from './student-payment-method.enum';

jest.mock('../common/password', () => ({
  hashPassword: jest.fn(async () => 'hashed-password'),
  verifyPassword: jest.fn(),
}));

const chain = <T>(value: T) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

function userDoc(overrides: Record<string, unknown> = {}) {
  const data = {
    _id: new Types.ObjectId().toHexString(),
    username: 'student01',
    email: 'student@example.com',
    phoneNumber: '+100000000',
    firstName: 'Student',
    lastName: 'One',
    role: Role.Student,
    status: UserStatus.Active,
    isActive: true,
    branchIds: [],
    studentYear: undefined,
    paymentMethod: undefined,
    contactOwner: undefined,
    contactOwnerFullName: undefined,
    contactOwnerRelation: undefined,
    ...overrides,
  };

  return {
    _id: data._id,
    email: data.email,
    phoneNumber: data.phoneNumber,
    studentYear: data.studentYear,
    paymentMethod: data.paymentMethod,
    contactOwner: data.contactOwner,
    contactOwnerFullName: data.contactOwnerFullName,
    contactOwnerRelation: data.contactOwnerRelation,
    branchIds: data.branchIds,
    role: data.role,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(() => data),
  };
}

function createService() {
  const courseModel = { find: jest.fn(), exists: jest.fn() };
  const groupModel = { find: jest.fn(), exists: jest.fn() };
  const scheduleModel = { find: jest.fn(), exists: jest.fn() };
  const usersRepository = {
    create: jest.fn((payload: Record<string, unknown>) => {
      const doc = userDoc(payload);
      doc.save.mockResolvedValue(doc);
      return doc;
    }),
    findOne: jest.fn(() => chain(null)),
    findByIdAndUpdate: jest.fn(
      (
        _id: string,
        _update: Record<string, unknown>,
        _options: Record<string, unknown>,
      ) => chain(userDoc()),
    ),
  };

  const service = new UsersService(
    usersRepository as never,
    courseModel as never,
    groupModel as never,
    scheduleModel as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
  );

  return { service, usersRepository, courseModel, groupModel, scheduleModel };
}

describe('UsersService contact fields', () => {
  it('create user saves email and phoneNumber', async () => {
    const { service, usersRepository } = createService();

    await service.create({
      username: 'student01',
      password: 'password123',
      firstName: 'Student',
      lastName: 'One',
      email: 'student@example.com',
      phoneNumber: '+100000000',
    });

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@example.com',
        phoneNumber: '+100000000',
      }),
    );

    const response = await service.create({
      username: 'student02',
      password: 'password123',
      firstName: 'Student',
      lastName: 'Two',
      email: 'student2@example.com',
      phoneNumber: '+100000001',
    });

    expect(response).toMatchObject({
      email: 'student2@example.com',
      phoneNumber: '+100000001',
    });
  });

  it('telephone and phone aliases map to canonical phoneNumber', async () => {
    const { service, usersRepository } = createService();

    await service.create({
      username: 'student01',
      password: 'password123',
      firstName: 'Student',
      lastName: 'One',
      telephone: '+200000000',
    });

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '+200000000' }),
    );
    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ telephone: '+200000000' }),
    );

    await service.updateOwnProfile('user-id', { phone: '+300000000' });
    expect(usersRepository.findByIdAndUpdate).toHaveBeenLastCalledWith(
      'user-id',
      { $set: { phoneNumber: '+300000000' } },
      { new: true },
    );
  });

  it('update user saves email and phoneNumber', async () => {
    const { service, usersRepository } = createService();

    await service.updateOwnProfile('user-id', {
      email: 'new@example.com',
      phoneNumber: '+400000000',
    });

    expect(usersRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      { $set: { email: 'new@example.com', phoneNumber: '+400000000' } },
      { new: true },
    );
  });

  it('update user returns contact and student fields', async () => {
    const { service, usersRepository } = createService();

    usersRepository.findByIdAndUpdate.mockImplementationOnce(
      (
        _id: string,
        update: { $set?: Record<string, unknown> },
        _options: Record<string, unknown>,
      ) => chain(userDoc(update.$set)),
    );

    const response = await service.update('user-id', {
      email: 'updated@example.com',
      phoneNumber: '+500000000',
      telegramId: '123456789',
      studentYear: '11-sinf',
      paymentMethod: StudentPaymentMethod.Card,
      contactOwner: 'ona',
      contactOwnerFullName: 'Aliyeva Dilnoza',
      contactOwnerRelation: 'onasi',
    });

    expect(usersRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      {
        $set: {
          email: 'updated@example.com',
          phoneNumber: '+500000000',
          telegramId: '123456789',
          studentYear: '11-sinf',
          paymentMethod: StudentPaymentMethod.Card,
          contactOwner: 'ona',
          contactOwnerFullName: 'Aliyeva Dilnoza',
          contactOwnerRelation: 'onasi',
        },
      },
      { new: true },
    );
    expect(response).toMatchObject({
      email: 'updated@example.com',
      phoneNumber: '+500000000',
      telegramId: '123456789',
      studentYear: '11-sinf',
      paymentMethod: StudentPaymentMethod.Card,
      contactOwner: 'ona',
      contactOwnerFullName: 'Aliyeva Dilnoza',
      contactOwnerRelation: 'onasi',
    });
  });

  it('create user saves optional student payment and contact owner fields', async () => {
    const { service, usersRepository } = createService();

    await service.create({
      username: 'student01',
      password: 'password123',
      firstName: 'Student',
      lastName: 'One',
      role: Role.Student,
      studentYear: '9-sinf',
      paymentMethod: 'naqd',
      contactOwner: 'ota',
      contactOwnerFullName: 'Aliyev Sardor',
      contactOwnerRelation: 'otasi',
    } as never);

    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentYear: '9-sinf',
        paymentMethod: StudentPaymentMethod.Cash,
        contactOwner: 'ota',
        contactOwnerFullName: 'Aliyev Sardor',
        contactOwnerRelation: 'otasi',
      }),
    );

    const response = await service.create({
      username: 'student02',
      password: 'password123',
      firstName: 'Student',
      lastName: 'Two',
      role: Role.Student,
      studentYear: '10-sinf',
      paymentMethod: 'card',
      contactOwner: 'ona',
      contactOwnerFullName: 'Aliyeva Dilnoza',
      contactOwnerRelation: 'onasi',
      telegramId: '123456789',
    } as never);

    expect(response).toMatchObject({
      studentYear: '10-sinf',
      paymentMethod: StudentPaymentMethod.Card,
      contactOwner: 'ona',
      contactOwnerFullName: 'Aliyeva Dilnoza',
      contactOwnerRelation: 'onasi',
      telegramId: '123456789',
    });
  });

  it('update user clears optional student profile fields with empty values', async () => {
    const { service, usersRepository } = createService();

    await service.updateOwnProfile('user-id', {
      studentYear: '',
      paymentMethod: null,
      contactOwner: ' ',
      contactOwnerFullName: null,
      contactOwnerRelation: '',
    } as never);

    expect(usersRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      {
        $unset: {
          studentYear: '',
          paymentMethod: '',
          contactOwner: '',
          contactOwnerFullName: '',
          contactOwnerRelation: '',
        },
      },
      { new: true },
    );
  });

  it('rejects unsupported student payment methods before persistence', async () => {
    const { service, usersRepository } = createService();

    await expect(
      service.create({
        username: 'student01',
        password: 'password123',
        firstName: 'Student',
        lastName: 'One',
        role: Role.Student,
        paymentMethod: 'transfer',
      } as never),
    ).rejects.toThrow('Payment method must be one of');

    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('update user does not delete contact fields when omitted', async () => {
    const { service, usersRepository } = createService();

    await service.updateOwnProfile('user-id', { firstName: 'Updated' });

    expect(usersRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      { $set: { firstName: 'Updated' } },
      { new: true },
    );
  });

  it('empty string and null intentionally clear optional contact fields', async () => {
    const { service, usersRepository } = createService();

    await service.updateOwnProfile('user-id', {
      email: '',
      phoneNumber: null,
    } as never);

    expect(usersRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      { $unset: { email: '', phoneNumber: '' } },
      { new: true },
    );
  });

  it('teacher student visibility includes groups from multi-teacher courses', async () => {
    const { service, courseModel, groupModel, scheduleModel } = createService();
    const teacherId = new Types.ObjectId().toHexString();
    const courseId = new Types.ObjectId().toHexString();
    const courseStudentId = new Types.ObjectId().toHexString();
    const groupStudentId = new Types.ObjectId().toHexString();
    const scheduleStudentId = new Types.ObjectId().toHexString();

    courseModel.find.mockReturnValueOnce(
      chain([{ _id: courseId, students: [courseStudentId] }]),
    );
    groupModel.find.mockReturnValueOnce(
      chain([{ students: [groupStudentId] }]),
    );
    scheduleModel.find.mockReturnValueOnce(
      chain([{ students: [scheduleStudentId] }]),
    );

    const visibleStudentIds = await (
      service as unknown as {
        getTeacherVisibleStudentIds: (id: string) => Promise<string[]>;
      }
    ).getTeacherVisibleStudentIds(teacherId);

    expect(groupModel.find).toHaveBeenCalledWith(
      {
        $or: [
          { teacher: teacherId },
          { course: { $in: [courseId] } },
        ],
      },
      { students: 1 },
    );
    expect(visibleStudentIds).toEqual(
      expect.arrayContaining([
        courseStudentId,
        groupStudentId,
        scheduleStudentId,
      ]),
    );
  });
});
