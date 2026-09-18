import { IsNumber, IsOptional } from 'class-validator';

/**
 * Genau eines von seriesId/calendarEventId muss angegeben werden - das wird
 * im OwnershipTransferService geprüft, nicht per Decorator, damit die
 * Fehlermeldung fachlich klar bleibt (statt einer generischen
 * class-validator-Meldung).
 */
export class TransferOwnerDto {
  @IsOptional()
  @IsNumber()
  seriesId?: number;

  @IsOptional()
  @IsNumber()
  calendarEventId?: number;

  @IsNumber()
  newOwnerId!: number;
}
