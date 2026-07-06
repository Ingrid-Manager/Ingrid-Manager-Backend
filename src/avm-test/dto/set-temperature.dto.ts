import { IsNumber, IsString } from 'class-validator';

export class SetTemperatureDto {
  @IsString()
  ain: string;

  @IsNumber()
  temperature: number;
}
