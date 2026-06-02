import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { BranchesService } from './branches.service';

const objectId = () => new Types.ObjectId().toHexString();

function actor(role: Role, branchIds: string[] = []): AuthenticatedUser {
  return { userId: objectId(), role, branchIds };
}

function branch(id: string, name = 'Main branch') {
  return {
    _id: new Types.ObjectId(id),
    name,
    address: 'Street 1',
    phone: '+998901234567',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function createModelMock(items: unknown[] = [], total = items.length) {
  const execFind = jest.fn().mockResolvedValue(items);
  const execOne = jest.fn().mockResolvedValue(items[0] ?? null);
  const execCount = jest.fn().mockResolvedValue(total);
  const limit = jest.fn().mockReturnValue({ exec: execFind });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const find = jest.fn().mockReturnValue({ sort });
  const findOne = jest.fn().mockReturnValue({ exec: execOne });
  const findByIdAndUpdate = jest.fn().mockReturnValue({ exec: execOne });
  const countDocuments = jest.fn().mockReturnValue({ exec: execCount });

  return {
    model: { find, findOne, findByIdAndUpdate, countDocuments },
    find,
    findOne,
    findByIdAndUpdate,
    countDocuments,
    sort,
    skip,
    limit,
    execFind,
    execOne,
    execCount,
  };
}

describe('BranchesService', () => {
  it('allows owner to list all branches', async () => {
    const branchId = objectId();
    const mock = createModelMock([branch(branchId)], 1);
    const service = new BranchesService(mock.model as never);

    const result = await service.findAllForActor({}, actor(Role.Owner));

    expect(mock.find).toHaveBeenCalledWith({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(branchId);
  });

  it('allows panda to list all branches', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await service.findAllForActor({}, actor(Role.Extra));

    expect(mock.find).toHaveBeenCalledWith({});
  });

  it('limits admin to assigned branch scope', async () => {
    const branchId = objectId();
    const mock = createModelMock([branch(branchId)], 1);
    const service = new BranchesService(mock.model as never);

    await service.findAllForActor({}, actor(Role.Admin, [branchId]));

    expect(mock.find).toHaveBeenCalledWith({
      _id: { $in: [expect.any(Types.ObjectId)] },
    });
    expect(String(mock.find.mock.calls[0][0]._id.$in[0])).toBe(branchId);
  });

  it('limits teacher to assigned branch scope', async () => {
    const branchId = objectId();
    const mock = createModelMock([branch(branchId)], 1);
    const service = new BranchesService(mock.model as never);

    await service.findAllForActor({}, actor(Role.Teacher, [branchId]));

    expect(String(mock.find.mock.calls[0][0]._id.$in[0])).toBe(branchId);
  });

  it('forbids students at service level', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await expect(
      service.findAllForActor({}, actor(Role.Student, [objectId()])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies search and active filters', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await service.findAllForActor(
      { search: 'main', active: false },
      actor(Role.Owner),
    );

    expect(mock.find).toHaveBeenCalledWith({
      isActive: false,
      $or: [
        { name: expect.any(RegExp) },
        { address: expect.any(RegExp) },
        { phone: expect.any(RegExp) },
      ],
    });
  });

  it('paginates branch list', async () => {
    const mock = createModelMock([], 42);
    const service = new BranchesService(mock.model as never);

    const result = await service.findAllForActor(
      { page: 3, limit: 10 },
      actor(Role.Owner),
    );

    expect(mock.skip).toHaveBeenCalledWith(20);
    expect(mock.limit).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 42,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('allows owner to update branch', async () => {
    const branchId = objectId();
    const mock = createModelMock([branch(branchId, 'Updated branch')], 1);
    const service = new BranchesService(mock.model as never);

    const result = await service.updateForActor(
      branchId,
      { name: ' Updated branch ', address: ' New address ' },
      actor(Role.Owner),
    );

    expect(mock.findByIdAndUpdate).toHaveBeenCalledWith(
      branchId,
      { $set: { name: 'Updated branch', address: 'New address' } },
      { new: true },
    );
    expect(result.name).toBe('Updated branch');
  });

  it('rejects admin branch updates', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await expect(
      service.updateForActor(
        objectId(),
        { name: 'Branch' },
        actor(Role.Admin, [objectId()]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to read scoped branch', async () => {
    const branchId = objectId();
    const mock = createModelMock([branch(branchId)], 1);
    const service = new BranchesService(mock.model as never);

    const result = await service.findByIdForActor(
      branchId,
      actor(Role.Admin, [branchId]),
    );

    expect(mock.findOne).toHaveBeenCalledWith({
      _id: { $in: [expect.any(Types.ObjectId)] },
    });
    expect(result.id).toBe(branchId);
  });

  it('rejects student branch reads', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await expect(
      service.findByIdForActor(objectId(), actor(Role.Student, [objectId()])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects empty branch name updates', async () => {
    const mock = createModelMock([], 0);
    const service = new BranchesService(mock.model as never);

    await expect(
      service.updateForActor(objectId(), { name: '   ' }, actor(Role.Owner)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
