import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import { hashPassword, verifyPassword as comparePassword } from '../common/password';
import { PublicUser } from './types/public-user.type';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { UsersListQueryDto } from './dto/users-list-query.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  private sanitizeUser(user: UserDocument): PublicUser {
    const obj = user.toObject() as User & {
      _id?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };

    return {
      id: String(user._id),
      _id: String(user._id),
      username: obj.username,
      telegramId: obj.telegramId,
      email: obj.email,
      firstName: obj.firstName,
      lastName: obj.lastName,
      role: obj.role,
      phoneNumber: obj.phoneNumber,
      isActive: obj.isActive,
      avatarUrl: obj.avatarUrl,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  private async ensureUniqueFields(dto: Partial<CreateUserDto>, excludeId?: string): Promise<void> {
    const checks: Array<[keyof CreateUserDto, unknown]> = [
      ['username', dto.username],
      ['email', dto.email],
      ['phoneNumber', dto.phoneNumber],
      ['telegramId', dto.telegramId],
    ];

    for (const [field, value] of checks) {
      if (!value) {
        continue;
      }

      const existing = await this.userModel
        .findOne({
          [field]: value,
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        })
        .lean()
        .exec();

      if (existing) {
        throw new ConflictException(`${String(field)} is already in use`);
      }
    }
  }

  private async ensureLastOwnerIsProtected(targetUserId: string, nextRole?: Role): Promise<void> {
    const existingUser = await this.userModel.findById(targetUserId).lean().exec();

    if (!existingUser || existingUser.role !== Role.Owner) {
      return;
    }

    if (nextRole === undefined || nextRole === Role.Owner) {
      return;
    }

    const ownersCount = await this.userModel.countDocuments({ role: Role.Owner }).exec();
    if (ownersCount <= 1) {
      throw new ConflictException('At least one owner must remain active in the system');
    }
  }

  async findByIdDoc(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByTelegramIdDoc(telegramId: number): Promise<UserDocument | null> {
    return this.userModel.findOne({ telegramId: String(telegramId) }).exec();
  }

  async findByUsernameForAuth(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
    return comparePassword(plainPassword, hashedPassword);
  }

  async findAll(query: UsersListQueryDto = {}): Promise<PublicUser[]> {
    const filter: FilterQuery<UserDocument> = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { username: regex },
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phoneNumber: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy && ['username', 'firstName', 'createdAt', 'role'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const users = await this.userModel
      .find(filter)
      .sort({ [sortBy]: sortOrder as SortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return serializeResources(users.map(user => this.sanitizeUser(user)));
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return serializeResource(this.sanitizeUser(user));
  }

  async findByUsername(username: string): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ username }).exec();
    return user ? serializeResource(this.sanitizeUser(user)) : null;
  }

  async findByPhone(phoneNumber: string): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ phoneNumber }).exec();
    return user ? serializeResource(this.sanitizeUser(user)) : null;
  }

  async findByTelegramId(telegramId: number): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ telegramId: String(telegramId) }).exec();
    return user ? serializeResource(this.sanitizeUser(user)) : null;
  }

  async findByRole(role: Role): Promise<PublicUser[]> {
    return this.findAll({ role });
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.ensureUniqueFields(dto);

    const createdUser = new this.userModel({
      ...dto,
      password: await hashPassword(dto.password),
      role: dto.role || Role.Guest,
    });

    const savedUser = await createdUser.save();
    return serializeResource(this.sanitizeUser(savedUser));
  }

  async createWithPhone(dto: {
    name: string;
    phone: string;
    telegramId: number;
    role: Role;
  }): Promise<PublicUser> {
    const createdUser = new this.userModel({
      firstName: dto.name,
      phoneNumber: dto.phone,
      telegramId: String(dto.telegramId),
      role: dto.role,
      username: dto.phone,
      isActive: true,
      password: await hashPassword(randomUUID()),
    });

    await this.ensureUniqueFields({
      username: createdUser.username,
      phoneNumber: createdUser.phoneNumber,
      telegramId: createdUser.telegramId,
    });

    const savedUser = await createdUser.save();
    return serializeResource(this.sanitizeUser(savedUser));
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const updatePayload = { ...dto } as UpdateUserDto;
    await this.ensureUniqueFields(updatePayload, id);
    await this.ensureLastOwnerIsProtected(id, updatePayload.role);

    if (updatePayload.password) {
      updatePayload.password = await hashPassword(updatePayload.password);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, updatePayload, { new: true }).exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return serializeResource(this.sanitizeUser(updatedUser));
  }

  async updateRole(id: string, role: Role): Promise<PublicUser> {
    if (!Object.values(Role).includes(role)) {
      throw new ConflictException('Invalid role');
    }

    await this.ensureLastOwnerIsProtected(id, role);

    const updatedUser = await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return serializeResource(this.sanitizeUser(updatedUser));
  }

  async remove(id: string): Promise<boolean> {
    await this.ensureLastOwnerIsProtected(id, Role.Guest);

    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    return true;
  }
}
