import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class SetTemperatureDto {
  @ApiProperty({
    example: 21,
    minimum: 16,
    maximum: 25,
    description:
      'Gewünschte Zieltemperatur in °C. Zulässig sind Werte in 0,5-°C-Schritten.',
  })
  @IsNumber()
  @Min(16)
  @Max(25)
  temperature!: number;
}
