import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
// import { PhoneRequestController } from './phone-request/phone-request.controller';
// import { PhoneRequestService } from './phone-request/phone-request.service';
import { PhoneRequest, PhoneRequestSchema } from './schemas/phone-request.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PhoneRequest.name, schema: PhoneRequestSchema }]),
    UsersModule,
  ],
  // controllers: [PhoneRequestController],
  // providers: [PhoneRequestService],
})
export class PhoneRequestModule {}
