import { IsDateString, IsOptional } from 'class-validator';

export class HeatingPreviewQueryDto {
  /** Simulierter Auswertungszeitpunkt (ISO-8601), Standard: jetzt. */
  @IsDateString()
  @IsOptional()
  at?: string;
}
