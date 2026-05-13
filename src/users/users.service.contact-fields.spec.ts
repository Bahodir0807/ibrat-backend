import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { Role } from '../roles/roles.enum';
import { UserStatus } from './user-status.enum';

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
    ...overrides,
  };

  return {
    _id: data._id,
    email: data.email,
    phoneNumber: data.phoneNumber,
    branchIds: data.branchIds,
    role: data.role,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(() => data),
  };
}

function createService() {
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
    { find: jest.fn(), exists: jest.fn() } as never,
    { find: jest.fn(), exists: jest.fn() } as never,
    { find: jest.fn(), exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
    { exists: jest.fn() } as never,
  );

  return { service, usersRepository };
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
});
