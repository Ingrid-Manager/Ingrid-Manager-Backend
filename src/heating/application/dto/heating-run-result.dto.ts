import { HeatingAction } from '../../domain/heating-rules';

export type HeatingCommandStatus =
  /** Befehl erfolgreich an den Dispatcher übergeben. */
  | 'sent'
  /** Nur Vorschau (dryRun), nichts gesendet/gespeichert. */
  | 'planned'
  /** Raum ohne avm_id: nur Zustand aktualisiert, kein Befehl. */
  | 'skipped'
  /** Dispatcher hat einen Fehler geworfen, Zustand unverändert. */
  | 'failed';

export class HeatingRoomResultDto {
  roomId!: number;
  title!: string;
  isHallway!: boolean;
  heatedBefore!: boolean;
  heatedAfter!: boolean;
  action!: HeatingAction | null;
  targetTemperature!: number | null;
  eventId!: number | null;
  reason!: string;
  status!: HeatingCommandStatus | null;
  error?: string;
}

export class HeatingRunResultDto {
  evaluatedAt!: Date;
  dryRun!: boolean;
  inSeason!: boolean;
  rooms!: HeatingRoomResultDto[];
}
