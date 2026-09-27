import { Injectable, Logger } from '@nestjs/common';
import {
  HeatingCommand,
  HeatingCommandDispatcher,
} from './heating-command-dispatcher';
import { FritzBoxConnectionService } from '../fritzbox/fritzbox-connection.service';

/** Wertebereich, den AVM-Thermostate per AHA (sethkrtsoll) annehmen. */
export const MIN_THERMOSTAT_TEMPERATURE = 8;
export const MAX_THERMOSTAT_TEMPERATURE = 28;

/**
 * Bringt eine Raumtemperatur in den von der FRITZ!Box unterstützten
 * Bereich (8–28 °C, 0,5-°C-Schritte).
 */
export function toThermostatTemperature(value: number): number {
  const rounded = Math.round(Number(value) * 2) / 2;
  return Math.min(
    MAX_THERMOSTAT_TEMPERATURE,
    Math.max(MIN_THERMOSTAT_TEMPERATURE, rounded),
  );
}

/**
 * Überträgt die Schaltbefehle der Heizregeln an die FRITZ!Box der
 * AVM Location des Raums: die Zieltemperatur des Thermostats bzw. der
 * Thermostat-Gruppe (room.avm_id = AIN) wird auf comfort_temp bzw.
 * empty_temp gesetzt.
 */
@Injectable()
export class FritzBoxHeatingCommandDispatcher implements HeatingCommandDispatcher {
  private readonly logger = new Logger('HeatingCommandDispatcher');

  constructor(private readonly fritzBoxService: FritzBoxConnectionService) {}

  async dispatch(command: HeatingCommand): Promise<void> {
    if (!Number.isFinite(Number(command.targetTemperature))) {
      throw new Error(
        `Ungültige Zieltemperatur "${command.targetTemperature}" für Raum "${command.roomTitle}"`,
      );
    }

    const temperature = toThermostatTemperature(command.targetTemperature);
    if (temperature !== Number(command.targetTemperature)) {
      this.logger.warn(
        `Zieltemperatur ${command.targetTemperature} °C für Raum "${command.roomTitle}" (#${command.roomId}) auf ${temperature} °C angepasst (FRITZ!Box: ${MIN_THERMOSTAT_TEMPERATURE}–${MAX_THERMOSTAT_TEMPERATURE} °C in 0,5-°C-Schritten)`,
      );
    }

    await this.fritzBoxService.setTemperature(
      command.locationId,
      command.avmId,
      temperature,
    );

    this.logger.log(
      `[${command.action}] Raum "${command.roomTitle}" (#${command.roomId}, AIN ${command.avmId}, Location #${command.locationId}) -> ${temperature} °C: ${command.reason}`,
    );
  }
}
