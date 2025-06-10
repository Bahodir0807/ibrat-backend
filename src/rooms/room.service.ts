import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  create(dto: CreateRoomDto) {
    return new this.roomModel(dto).save();
  }

  findAll() {
    return this.roomModel.find().exec();
  }

  async findById(id: string) {
    const room = await this.roomModel.findById(id).exec();
    if (!room) throw new NotFoundException('Аудитория не найдена');
    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    const updated = await this.roomModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Аудитория не найдена');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.roomModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Аудитория не найдена');
    return { success: true };
  }
}