import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import {
  hashPassword,
  verifyPassword as comparePassword,
} from '../common/password';
import { PublicUser } from './types/public-user.type';

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

  async findAll(): Promise<PublicUser[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => this.sanitizeUser(user));
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async findByUsername(username: string): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ username }).exec();
    return user ? this.sanitizeUser(user) : null;
  }

  async findByPhone(phoneNumber: string): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ phoneNumber }).exec();
    return user ? this.sanitizeUser(user) : null;
  }

  async findByTelegramId(telegramId: number): Promise<PublicUser | null> {
    const user = await this.userModel.findOne({ telegramId: String(telegramId) }).exec();
    return user ? this.sanitizeUser(user) : null;
  }

  async findByRole(role: Role): Promise<PublicUser[]> {
    const users = await this.userModel.find({ role }).exec();
    return users.map(user => this.sanitizeUser(user));
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const existingUser = await this.userModel.findOne({ username: dto.username }).exec();
    if (existingUser) {
      throw new BadRequestException('Username is already taken');
    }

    const createdUser = new this.userModel({
      ...dto,
      password: await hashPassword(dto.password),
      role: dto.role || Role.Guest,
    });

    const savedUser = await createdUser.save();
    return this.sanitizeUser(savedUser);
  }

  async createWithPhone(dto: {
    name: string;
    phone: string;
    telegramId: number;
    role: Role;
  }): Promise<PublicUser> {
    const existingUser = await this.findByPhone(dto.phone);
    if (existingUser) {
      throw new BadRequestException('User with this phone number already exists');
    }

    const createdUser = new this.userModel({
      firstName: dto.name,
      phoneNumber: dto.phone,
      telegramId: String(dto.telegramId),
      role: dto.role,
      username: dto.phone,
      isActive: true,
      password: await hashPassword(randomUUID()),
    });

    const savedUser = await createdUser.save();
    return this.sanitizeUser(savedUser);
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const updatePayload = { ...dto } as UpdateUserDto;
    if (updatePayload.password) {
      updatePayload.password = await hashPassword(updatePayload.password);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(updatedUser);
  }

  async updateRole(id: string, role: Role): Promise<PublicUser> {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException('Invalid role');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { role }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(updatedUser);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    return true;
  }
}
