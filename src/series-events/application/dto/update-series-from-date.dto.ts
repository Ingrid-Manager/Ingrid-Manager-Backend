import { IsDateString, IsEnum, IsOptional } from 'class-validator';

import { UpdateSeriesEventDto } from './update-series-event.dto';
import { SeriesFrequency } from '../../frequencys.enum';

export class UpdateSeriesFromDateDto extends UpdateSeriesEventDto {
  @IsDateString()
  splitDate!: string;

  @IsEnum(SeriesFrequency)
  @IsOptional()
  frequency?: SeriesFrequency;
}
