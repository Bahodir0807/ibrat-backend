import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StudentStatus } from '../student-status.enum';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({ unique: true, sparse: true })
  studentNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userAccountId?: Types.ObjectId;

  @Prop({ default: '' })
  firstName!: string;

  @Prop({ default: '' })
  lastName!: string;

  @Prop()
  phoneNumber?: string;

  @Prop({ unique: true, sparse: true })
  telegramId?: string;

  @Prop()
  parentPhoneNumber?: string;

  @Prop()
  parentName?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Group', default: [] })
  groupIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Course', default: [] })
  courseIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [] })
  branchIds!: Types.ObjectId[];

  @Prop()
  monthlyPayment?: number;

  @Prop()
  paymentDueDate?: Date;

  @Prop()
  comment?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ enum: StudentStatus, default: StudentStatus.Active })
  status!: StudentStatus;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
StudentSchema.index({ firstName: 1, lastName: 1 });
StudentSchema.index({ phoneNumber: 1 });
StudentSchema.index({ groupIds: 1 });
StudentSchema.index({ courseIds: 1 });
StudentSchema.index({ branchIds: 1 });
StudentSchema.index({ isActive: 1, status: 1 });
StudentSchema.index({ createdAt: -1 });
