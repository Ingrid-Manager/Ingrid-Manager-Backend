import { IsNumber } from 'class-validator';

export class DeactivateSeriesDto {
  @IsNumber()
  id!: number;
}
