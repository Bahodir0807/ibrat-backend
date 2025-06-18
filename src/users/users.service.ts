import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export { UserDocument };
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const envKey = process.env.ENCRYPTION_KEY;
if (!envKey) {
  throw new Error('ENCRYPTION_KEY is not set in environment variables');
}
const ENCRYPTION_KEY = crypto.createHash('sha256').update(envKey).digest();
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(shouldDecrypt: boolean = false): Promise<User[]> {
    const users = await this.userModel.find().exec();
    if (shouldDecrypt) {
      return users.map(user => ({
        ...user.toObject(),
        password: decrypt(user.password)
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

    const createdUser = new this.userModel({
      username: dto.username,
      password: encrypt(dto.password),
      role: dto.role,
    });
    return createdUser.save();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      (dto as any).password = encrypt(dto.password);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updatedUser) throw new NotFoundException('Пользователь не найден');

    const obj = updatedUser.toObject();
    obj.password = decrypt(obj.password);
    return obj;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { role }, { new: true })
      .exec();
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
