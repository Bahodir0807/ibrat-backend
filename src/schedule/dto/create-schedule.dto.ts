import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';

export class CreateScheduleDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsDateString()
    @IsNotEmpty()
    startTime: string;

    @IsDateString()
    @IsNotEmpty()
    endTime: string;

    @IsString()
    @IsOptional()
    description?: string;
}