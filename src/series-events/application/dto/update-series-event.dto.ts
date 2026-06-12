import { PartialType } from '@nestjs/mapped-types';
import { CreateSeriesEventDto } from './create-series-event.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateSeriesEventDto extends PartialType(CreateSeriesEventDto) {
  @IsOptional()
  @IsNumber()
  id?: number;
}
