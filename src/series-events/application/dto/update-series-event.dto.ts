import { PartialType } from '@nestjs/swagger';
import { CreateSeriesEventDto } from './create-series-event.dto';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { SeriesFrequency } from '../../frequencys.enum';

export class UpdateSeriesEventDto extends PartialType(CreateSeriesEventDto) {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsEnum(SeriesFrequency)
  @IsOptional()
  frequency?: SeriesFrequency;
}
