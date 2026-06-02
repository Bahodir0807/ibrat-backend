import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  ensureActorBranchScope,
  isSystemWideRole,
  toObjectIds,
} from '../common/access/actor-scope';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Role } from '../roles/roles.enum';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { BranchesListQueryDto } from './dto/branches-list-query.dto';
import {
  mapBranchResponse,
  mapBranchResponses,
} from './dto/branch-response.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  private getSort(query: BranchesListQueryDto) {
    const sortBy =
      query.sortBy && ['name', 'createdAt', 'updatedAt'].includes(query.sortBy)
        ? query.sortBy
        : 'name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  private buildBaseFilter(
    query: BranchesListQueryDto = {},
  ): FilterQuery<BranchDocument> {
    const filter: FilterQuery<BranchDocument> = {};

    if (query.active !== undefined) {
      filter.isActive = query.active;
    }

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { address: regex }, { phone: regex }];
    }

    return filter;
  }

  private applyActorScope(
    filter: FilterQuery<BranchDocument>,
    actor: AuthenticatedUser,
  ): FilterQuery<BranchDocument> {
    if (actor.role === Role.Student) {
      throw new ForbiddenException('Students cannot access branches');
    }

    if (isSystemWideRole(actor.role)) {
      return filter;
    }

    const scopedBranchIds = toObjectIds(ensureActorBranchScope(actor));
    if (scopedBranchIds.length === 0) {
      throw new ForbiddenException('User has no valid branch scope');
    }

    if (filter._id instanceof Types.ObjectId) {
      const requestedId = filter._id.toHexString();
      return {
        ...filter,
        _id: {
          $in: scopedBranchIds.filter(
            (branchId) => branchId.toHexString() === requestedId,
          ),
        },
      };
    }

    return {
      ...filter,
      _id: { $in: scopedBranchIds },
    };
  }

  async findAllForActor(
    query: BranchesListQueryDto = {},
    actor: AuthenticatedUser,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.applyActorScope(this.buildBaseFilter(query), actor);

    const [branches, total] = await Promise.all([
      this.branchModel
        .find(filter)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.branchModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(
      mapBranchResponses(branches),
      total,
      page,
      limit,
    );
  }

  async findByIdForActor(id: string, actor: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid branch ID');
    }

    const filter = this.applyActorScope({ _id: new Types.ObjectId(id) }, actor);
    const branch = await this.branchModel.findOne(filter).exec();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return mapBranchResponse(branch);
  }

  async updateForActor(
    id: string,
    dto: UpdateBranchDto,
    actor: AuthenticatedUser,
  ) {
    if (!isSystemWideRole(actor.role)) {
      throw new ForbiddenException('Only owner can update branches');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid branch ID');
    }

    const payload = Object.fromEntries(
      Object.entries(dto).flatMap(([key, value]) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (key === 'name' && trimmed.length === 0) {
            throw new BadRequestException('Branch name is required');
          }
          return [[key, trimmed]];
        }

        if (value === undefined) {
          return [];
        }

        return [[key, value]];
      }),
    );

    const updated = await this.branchModel
      .findByIdAndUpdate(id, { $set: payload }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Branch not found');
    }

    return mapBranchResponse(updated);
  }
}
