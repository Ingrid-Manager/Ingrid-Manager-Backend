import { HeatingAction } from '../domain/heating-rules';

/**
 * Injection-Token für die Anbindung an die Fritzbox.
 *
 * Das HeatingRulesModule wertet nur die Heizregeln aus und übergibt die
 * daraus resultierenden Schaltbefehle an diesen Dispatcher. Die
 * Implementierung `FritzboxHeatingCommandDispatcher` sendet sie über den
 * AHA-Client an die FRITZ!Box der AVM-Location des Raums.
 */
export const HEATING_COMMAND_DISPATCHER = Symbol('HEATING_COMMAND_DISPATCHER');

export interface HeatingCommand {
  action: HeatingAction;
  roomId: number;
  roomTitle: string;
  /** AVM Geräte- oder Gruppen-ID (AIN) des Raums. */
  avmId: string;
  /** avmlocation.id - bestimmt, welche Fritzbox angesprochen wird. */
  locationId: number;
  /** comfort_temp beim Aufheizen, empty_temp beim Absenken (°C). */
  targetTemperature: number;
  /** Ausschlaggebender Termin, null bei Flur/Saison-Ende/Init. */
  eventId: number | null;
  reason: string;
}

export interface HeatingCommandDispatcher {
  /**
   * Führt den Schaltbefehl aus. Wirft einen Fehler, wenn der Befehl nicht
   * zugestellt werden konnte - der `heated`-Zustand des Raums wird dann
   * nicht geändert und der Befehl beim nächsten Lauf erneut versucht.
   */
  dispatch(command: HeatingCommand): Promise<void>;
}
