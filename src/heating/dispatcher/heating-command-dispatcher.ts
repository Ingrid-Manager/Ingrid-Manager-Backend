import { Injectable, Logger } from '@nestjs/common';
import { HeatingAction } from '../domain/heating-rules';

/**
 * Injection-Token für die Anbindung an die Fritzbox.
 *
 * Das HeatingModule wertet nur die Heizregeln aus und übergibt die daraus
 * resultierenden Schaltbefehle an diesen Dispatcher. Sobald das
 * Fritzbox-Modul fertig ist, wird im HeatingModule lediglich der Provider
 * für dieses Token ausgetauscht (z. B. `useClass: FritzboxHeatingDispatcher`).
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

/**
 * Platzhalter bis zur Fertigstellung des Fritzbox-Moduls: protokolliert
 * die Befehle nur, ohne ein Thermostat anzusprechen.
 */
@Injectable()
export class LoggingHeatingCommandDispatcher implements HeatingCommandDispatcher {
  private readonly logger = new Logger('HeatingCommandDispatcher');

  dispatch(command: HeatingCommand): Promise<void> {
    this.logger.log(
      `[${command.action}] Raum "${command.roomTitle}" (#${command.roomId}, AVM ${command.avmId}, Location #${command.locationId}) -> ${command.targetTemperature} °C: ${command.reason}`,
    );
    return Promise.resolve();
  }
}
