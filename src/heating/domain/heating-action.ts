/*
 * Fachliche Heizaktionen, wie sie die kalendergesteuerte Heizungsregel
 * erzeugt. Sie enthalten bewusst keine AHA-/FRITZ!Box-spezifischen Details:
 * die konkrete Ausführung übernimmt der HeatingService.
 */
export type HeatingActionType = 'HEAT' | 'COOL';

export interface HeatingAction {
  roomId: number;
  locationId: number;
  action: HeatingActionType;
  targetTemperature: number;
  /*
   * AVM Geräte- oder Gruppen-ID des Raums (room.avm_id). Ist keine
   * hinterlegt, wird nur der Raumzustand (heated) fortgeschrieben.
   */
  avmId: string | null;
  /*
   * Termin, der die Entscheidung ausgelöst hat (null z. B. beim Flur oder
   * beim Absenken am Ende der Heizsaison).
   */
  eventId: number | null;
  reason: HeatingActionReason;
}

export type HeatingActionReason =
  | 'EVENT_PRELIM'
  | 'EVENT_ENDED'
  | 'NO_ACTIVE_EVENT'
  | 'HALLWAY_OCCUPIED'
  | 'HALLWAY_EMPTY'
  | 'SEASON_END';

export type HeatingActionStatus = 'applied' | 'skipped' | 'failed';

export interface HeatingActionResult {
  action: HeatingAction;
  /*
   * applied = Thermostat wurde gesetzt
   * skipped = kein Thermostat hinterlegt, nur Zustandswechsel
   * failed  = Ausführung fehlgeschlagen, Zustand bleibt unverändert
   */
  status: HeatingActionStatus;
  error?: Error;
}
