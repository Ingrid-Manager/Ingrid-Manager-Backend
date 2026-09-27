import { Injectable, Logger } from '@nestjs/common';

import {
  HeatingCommand,
  HeatingCommandDispatcher,
} from '../dispatcher/heating-command-dispatcher';
import { FritzboxConnectionService } from './fritzbox-connection.service';

/** Kleinste Solltemperatur, die die FRITZ!Box annimmt (°C). */
export const FRITZBOX_MIN_TEMPERATURE = 8;
/** Größte Solltemperatur, die die FRITZ!Box annimmt (°C). */
export const FRITZBOX_MAX_TEMPERATURE = 28;

/**
 * Bringt eine Temperatur in den Bereich, den die FRITZ!Box annimmt:
 * 8–28 °C in 0,5-°C-Schritten (Werte außerhalb werden begrenzt,
 * Zwischenwerte auf den nächsten halben Grad gerundet).
 */
export function toFritzboxTemperature(value: number | string): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numeric)) {
    throw new Error(`Ungültige Zieltemperatur: ${String(value)}`);
  }

  const clamped = Math.min(
    FRITZBOX_MAX_TEMPERATURE,
    Math.max(FRITZBOX_MIN_TEMPERATURE, numeric),
  );
  return Math.round(clamped * 2) / 2;
}

export class FritzboxDispatchError extends Error {
  readonly name = 'FritzboxDispatchError';

  constructor(
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
  }
}

/**
 * Sendet die Schaltbefehle der Heizregeln an die FRITZ!Box der
 * AVM-Location des Raums: Solltemperatur (`sethkrtsoll`) auf der AIN aus
 * `room.avm_id` – Thermostat oder Gruppe.
 *
 * Schlägt ein Befehl fehl, wird ein Fehler geworfen; `heated` bleibt dann
 * unverändert und der nächste Lauf versucht es erneut.
 */
@Injectable()
export class FritzboxHeatingCommandDispatcher implements HeatingCommandDispatcher {
  private readonly logger = new Logger('HeatingCommandDispatcher');

  constructor(private readonly connections: FritzboxConnectionService) {}

  async dispatch(command: HeatingCommand): Promise<void> {
    const temperature = toFritzboxTemperature(command.targetTemperature);

    if (temperature !== Number(command.targetTemperature)) {
      this.logger.warn(
        `Raum "${command.roomTitle}" (#${command.roomId}): ${command.targetTemperature} °C liegt nicht im FRITZ!Box-Bereich (${FRITZBOX_MIN_TEMPERATURE}–${FRITZBOX_MAX_TEMPERATURE} °C, 0,5-°C-Schritte), sende ${temperature} °C`,
      );
    }

    try {
      await this.connections.withConnection(command.locationId, (box) =>
        box.thermostats.get(command.avmId).setTemperature(temperature),
      );
    } catch (error) {
      const reason =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      throw new FritzboxDispatchError(
        `FRITZ!Box von AVM-Location #${command.locationId} (AIN ${command.avmId}): ${reason}`,
        error,
      );
    }

    this.logger.log(
      `[${command.action}] Raum "${command.roomTitle}" (#${command.roomId}, AIN ${command.avmId}, Location #${command.locationId}) -> ${temperature} °C: ${command.reason}`,
    );
  }
}
