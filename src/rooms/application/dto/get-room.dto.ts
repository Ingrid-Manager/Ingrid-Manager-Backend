import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetRoomDto {
  @Type(() => Number)
  @IsNumber()
  id!: number;
}
