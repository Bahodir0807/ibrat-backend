import { IsNotEmpty } from "class-validator";

export class CreatePaymentsDto {
    @IsNotEmpty()
    amount: number;

    @IsNotEmpty()
    status: string;
}
