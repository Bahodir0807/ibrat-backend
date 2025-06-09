import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';

@Injectable()
export class ScheduleService {
  private schedules: Array<CreateScheduleDto & { id: string }> = [];
  private id = 1;

  async create(createScheduleDto: CreateScheduleDto) {
    const schedule = { id: String(this.id++), ...createScheduleDto };
    this.schedules.push(schedule);
    return schedule;
  }

  async findAll() {
    return this.schedules;
  }

  async findOne(id: string) {
    const schedule = this.schedules.find(s => s.id === id);
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.findOne(id);
    Object.assign(schedule, updateScheduleDto);
    return schedule;
  }

  async remove(id: string) {
    const idx = this.schedules.findIndex(s => s.id === id);
    if (idx === -1) throw new NotFoundException('Schedule not found');
    const [removed] = this.schedules.splice(idx, 1);
    return removed;
  }
}
