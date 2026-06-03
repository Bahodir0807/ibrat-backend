import { ScheduleService } from './schedule.service';

describe('ScheduleService payload normalization', () => {
  const originalOffset = process.env.SCHEDULE_TIMEZONE_OFFSET_MINUTES;

  afterEach(() => {
    process.env.SCHEDULE_TIMEZONE_OFFSET_MINUTES = originalOffset;
    jest.useRealTimers();
  });

  it('derives persisted UTC dates from weekdays and time-only hours', () => {
    process.env.SCHEDULE_TIMEZONE_OFFSET_MINUTES = '300';
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
    const service = new ScheduleService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state = (service as any).toScheduleState({
      course: '507f1f77bcf86cd799439011',
      room: '507f1f77bcf86cd799439012',
      teacher: '507f1f77bcf86cd799439013',
      weekdays: ['Monday', 'Wednesday'],
      timeStart: '10:00',
      timeEnd: '11:00',
    });

    expect(state.weekdays).toEqual(['Monday', 'Wednesday']);
    expect(state.date.toISOString()).toBe('2026-06-01T05:00:00.000Z');
    expect(state.timeStart.toISOString()).toBe('2026-06-01T05:00:00.000Z');
    expect(state.timeEnd.toISOString()).toBe('2026-06-01T06:00:00.000Z');
  });
});
