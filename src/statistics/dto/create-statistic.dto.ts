export class CreateStatisticDto {
    readonly date: Date;
    readonly type: string;
    readonly value: number;
    readonly metadata?: Record<string, any>;
  }
  