import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').exec(); 
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({ username: dto.username }).exec();
    if (existingUser) throw new BadRequestException('Имя пользователя уже занято');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const createdUser = new this.userModel({
      username: dto.username,
      password: hashedPassword,
      role: dto.role,
    });
    return createdUser.save();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('Пользователь не найден');
    return updatedUser;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { role }, { new: true })
      .select('-password')
      .exec();
    if (!updatedUser) throw new NotFoundException('Пользователь не найден');
    return updatedUser;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Пользователь не найден');
    return true;
  }
}
