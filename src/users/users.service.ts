import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
export { UserDocument };
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import { encrypt, decrypt } from '../common/encryption';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(shouldDecrypt: boolean = false): Promise<User[]> {
    const users = await this.userModel.find().exec();
    if (shouldDecrypt) {
      return users.map(user => ({
        ...user.toObject(),
        password: decrypt(user.password),
      }));
    }
    return users;
  }

  async findStudentById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user || user.role !== Role.Student) {
      throw new NotFoundException('Ученик не найден');
    }
    return user;
  }

  async findById(id: string, shouldDecrypt: boolean = false): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('Пользователь не найден');
    const obj = user.toObject();
    if (shouldDecrypt) {
      obj.password = decrypt(obj.password);
    }
    return obj;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({ username: dto.username }).exec();
    if (existingUser) throw new BadRequestException('Имя пользователя уже занято');

    if (dto.role && dto.role !== Role.Student && dto.roleKey !== process.env.SUPER_ROLE_KEY) {
      throw new BadRequestException('Недостаточно прав для назначения этой роли');
    }

    const { roleKey, ...safeDto } = dto;

    const createdUser = new this.userModel({
      username: safeDto.username,
      password: encrypt(safeDto.password),
      role: safeDto.role || Role.Student,
    });

    return createdUser.save();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      (dto as any).password = encrypt(dto.password);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updatedUser) throw new NotFoundException('Пользователь не найден');

    const obj = updatedUser.toObject();
    obj.password = decrypt(obj.password);
    return obj;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const updatedUser = await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
    if (!updatedUser) throw new NotFoundException('Пользователь не найден');

    const obj = updatedUser.toObject();
    obj.password = decrypt(obj.password);
    return obj;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Пользователь не найден');
    return true;
  }

  decryptPassword(encryptedPassword: string): string {
    return decrypt(encryptedPassword);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findByTelegramId(telegramId: number) {
    return this.userModel.findOne({ telegramId });
  }

  async createWithPhone(dto: { name: string; phone: string; telegramId: number; role: Role }): Promise<User> {
    const existingUser = await this.findByPhone(dto.phone);
    if (existingUser) throw new BadRequestException('Пользователь с таким номером уже существует');

    const rawPassword = '123456';
    const encryptedPassword = encrypt(rawPassword);

    const createdUser = new this.userModel({
      name: dto.name,
      phone: dto.phone,
      telegramId: dto.telegramId,
      role: dto.role,
      username: dto.phone,
      password: encryptedPassword,
    });

    return createdUser.save();
  }
}
