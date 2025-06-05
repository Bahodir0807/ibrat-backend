import { Injectable } from '@nestjs/common';
// Обычно схему (User, UserSchema) выносят в отдельный файл user.schema.ts.
// В файле users.service.ts обычно не размещают схему.
// Создайте файл user.schema.ts и поместите туда этот код:

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
    @Prop({ required: true })
    username: string;

    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
