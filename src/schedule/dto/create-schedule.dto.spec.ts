import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateScheduleDto } from './create-schedule.dto';

describe('CreateScheduleDto', () => {
  const basePayload = {
    course: '507f1f77bcf86cd799439011',
    room: '507f1f77bcf86cd799439012',
    timeStart: '10:00',
    timeEnd: '11:00',
    teacher: '507f1f77bcf86cd799439013',
    weekdays: ['Monday'],
  };

  it('accepts weekdays and time-only payload', () => {
    const dto = plainToInstance(CreateScheduleDto, {
      ...basePayload,
      weekdays: ['Monday', 'Wednesday'],
    });

    expect(validateSync(dto, { whitelist: true })).toEqual([]);
  });

  it('rejects invalid weekdays values', () => {
    const dto = plainToInstance(CreateScheduleDto, {
      ...basePayload,
      weekdays: ['Funday'],
    });

    expect(validateSync(dto, { whitelist: true })).not.toEqual([]);
  });

  it('rejects date as a public payload field', () => {
    const dto = plainToInstance(CreateScheduleDto, {
      ...basePayload,
      date: '2026-06-04',
    });

    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});
