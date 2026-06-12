import { IsDateString } from 'class-validator';

import { UpdateSeriesEventDto } from './update-series-event.dto';

export class UpdateSeriesFromDateDto extends UpdateSeriesEventDto {
  @IsDateString()
  splitDate!: string;
}
