import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import { encrypt, decrypt } from '../common/encryption';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private decryptUser(user: UserDocument): User {
    const obj = user.toObject();
    obj.password = decrypt(obj.password);
    return obj;
  }

  // Найти всех пользователей
  async findAll(): Promise<User[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => this.decryptUser(user));
  }

  // Найти по ID
  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return this.decryptUser(user);
  }

  // Найти по username
  async findByUsername(username: string): Promise<User | null> {
    const user = await this.userModel.findOne({ username }).exec();
    return user ? this.decryptUser(user) : null;
  }

  // Найти по телефону
  async findByPhone(phone: string): Promise<User | null> {
    const user = await this.userModel.findOne({ phone }).exec();
    return user ? this.decryptUser(user) : null;
  }

  // Найти по Telegram ID
  async findByTelegramId(telegramId: number): Promise<User | null> {
    const user = await this.userModel.findOne({ telegramId }).exec();
    return user ? this.decryptUser(user) : null;
  }

  // Найти по роли
  async findByRole(role: Role): Promise<User[]> {
    const users = await this.userModel.find({ role }).exec();
    return users.map(user => this.decryptUser(user));
  }

  // Создать пользователя
  async create(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({ username: dto.username }).exec();
    if (existingUser) throw new BadRequestException('Имя пользователя уже занято');

    const createdUser = new this.userModel({
      username: dto.username,
      password: encrypt(dto.password),
      role: dto.role || Role.Guest,
    });

    const savedUser = await createdUser.save();
    return this.decryptUser(savedUser);
  }

  // Создать пользователя с телефоном
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

    const savedUser = await createdUser.save();
    return this.decryptUser(savedUser);
  }

  // Обновить пользователя
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      (dto as any).password = encrypt(dto.password);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return this.decryptUser(updatedUser);
  }

  // Обновить роль
  async updateRole(id: string, role: Role): Promise<User> {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException('Некорректная роль');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
    if (!updatedUser) throw new NotFoundException('User not found');
    return this.decryptUser(updatedUser);
  }

  // Удалить пользователя
  async remove(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('User not found');
    return true;
  }
}
