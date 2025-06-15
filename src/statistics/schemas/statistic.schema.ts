import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type StatisticDocument = Statistic & Document;

@Schema()
export class Statistic {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  value: number;

  @Prop({ type: Map })
  metadata?: Map<string, any>;
}

export const StatisticSchema = SchemaFactory.createForClass(Statistic);
