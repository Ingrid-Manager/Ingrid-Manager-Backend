import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetResourceDto {
  @Type(() => Number)
  @IsNumber()
  id!: number;
}
