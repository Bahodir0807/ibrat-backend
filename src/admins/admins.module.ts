import { Module } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';

@Module({
  imports: [],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
