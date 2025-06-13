import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Room, RoomSchema } from './schemas/room.schema';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { RoomsModule } from './rooms.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }]), RoomsModule],
  controllers: [RoomController, RoomsController],
  providers: [RoomService, RoomsService],
  exports: [RoomService],
})
export class RoomModule {}