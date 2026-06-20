import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetRessourceDto {
  @Type(() => Number)
  @IsNumber()
  id!: number;
}
