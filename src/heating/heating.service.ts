import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { FritzBox, FritzBoxConfig } from '../libs/fritzbox-aha/index.js';

import type { ConnectHeatingDto } from './dto/connect-heating.dto';
import { HeatingAction, HeatingActionResult } from './domain/heating-action';
import {
  HeatingError,
  HeatingErrorCode,
  toHeatingError,
} from './domain/heating-error';
import { isValidTargetTemperature } from './domain/heating-temperature';
import { FritzBoxConnectionManager } from './fritzbox-connection-manager.service';
import { toDiagnosticHttpError } from './diagnostic-http-error';

@Injectable()
export class HeatingService {
  private readonly logger = new Logger(HeatingService.name);

  /*
   * Manuell über POST /heating/connect hergestellte Verbindung für die
   * Diagnose-Endpunkte des HeatingControllers. Die kalendergesteuerte
   * Heizung verwendet stattdessen die Verbindung der jeweiligen Location
   * (siehe executeLocationActions).
   */
  private fritzBox?: FritzBox;

  constructor(private readonly connections: FritzBoxConnectionManager) {}

  /*
   * Führt Heizaktionen einer einzelnen Location über deren eigene
   * FRITZ!Box-Verbindung aus.
   *
   * Aktionen einer anderen Location werden abgelehnt und niemals an diese
   * FRITZ!Box gesendet. Fehler werden pro Aktion zurückgemeldet und nicht
   * geworfen, damit ein defektes Thermostat die übrigen Aktionen nicht
   * blockiert.
   */
  async executeLocationActions(
    locationId: number,
    actions: HeatingAction[],
  ): Promise<HeatingActionResult[]> {
    const results = new Map<HeatingAction, HeatingActionResult>();
    const deviceActions: HeatingAction[] = [];

    for (const action of actions) {
      const context = {
        locationId: action.locationId,
        roomId: action.roomId,
        avmId: action.avmId,
      };

      if (action.locationId !== locationId) {
        results.set(action, {
          action,
          status: 'failed',
          error: new HeatingError(
            HeatingErrorCode.CONFIGURATION_ERROR,
            `Action belongs to location ${action.locationId}, not to location ${locationId}`,
            context,
          ),
        });
        continue;
      }

      if (!isValidTargetTemperature(action.targetTemperature)) {
        results.set(action, {
          action,
          status: 'failed',
          error: new HeatingError(
            HeatingErrorCode.INVALID_TEMPERATURE,
            `Invalid target temperature ${String(action.targetTemperature)}`,
            context,
          ),
        });
        continue;
      }

      if (!action.avmId || !action.avmId.trim()) {
        // Kein Thermostat hinterlegt: nur der Raumzustand wird geführt.
        results.set(action, { action, status: 'skipped' });
        continue;
      }

      deviceActions.push(action);
    }

    if (deviceActions.length > 0) {
      let box: FritzBox | undefined;

      try {
        box = await this.connections.getConnection(locationId);
      } catch (error) {
        const heatingError = toHeatingError(
          error,
          HeatingErrorCode.FRITZBOX_UNREACHABLE,
          { locationId },
        );

        for (const action of deviceActions) {
          results.set(action, {
            action,
            status: 'failed',
            error: heatingError,
          });
        }
      }

      if (box) {
        let unreachable: HeatingError | undefined;

        for (const action of deviceActions) {
          if (unreachable) {
            // FRITZ!Box ist weg: restliche Aktionen gar nicht erst senden.
            results.set(action, {
              action,
              status: 'failed',
              error: unreachable,
            });
            continue;
          }

          const result = await this.applyToDevice(box, action);
          results.set(action, result);

          if (
            result.error instanceof HeatingError &&
            result.error.code === HeatingErrorCode.FRITZBOX_UNREACHABLE
          ) {
            unreachable = result.error;
          }
        }
      }
    }

    return actions.map((action) => results.get(action));
  }

  private async applyToDevice(
    box: FritzBox,
    action: HeatingAction,
  ): Promise<HeatingActionResult> {
    const ain = action.avmId.trim();
    const context = {
      locationId: action.locationId,
      roomId: action.roomId,
      avmId: ain,
    };

    try {
      const devices = await box.listDevices();
      const device = devices.find((item) => item.ain === ain);

      if (!device && !(await box.isGroup(ain))) {
        throw new HeatingError(
          HeatingErrorCode.THERMOSTAT_UNREACHABLE,
          `Thermostat ${ain} is unknown to the FRITZ!Box of location ${action.locationId}`,
          context,
        );
      }

      if (device && !device.present) {
        throw new HeatingError(
          HeatingErrorCode.THERMOSTAT_UNREACHABLE,
          `Thermostat ${ain} is not reachable`,
          context,
        );
      }

      await box.thermostats.get(ain).setTemperature(action.targetTemperature);

      this.logger.log(
        `${action.action} location=${action.locationId} room=${action.roomId} ain=${ain} -> ${action.targetTemperature} °C (${action.reason})`,
      );

      return { action, status: 'applied' };
    } catch (error) {
      const heatingError = toHeatingError(
        error,
        HeatingErrorCode.THERMOSTAT_UNREACHABLE,
        context,
      );

      if (heatingError.code === HeatingErrorCode.FRITZBOX_UNREACHABLE) {
        await this.connections.invalidate(action.locationId);
      }

      return { action, status: 'failed', error: heatingError };
    }
  }

  /*
   * Diagnoseverbindung (POST /heating/connect). Eine bestehende Verbindung
   * wird erst nach erfolgreichem Aufbau der neuen abgemeldet, damit keine
   * verwaisten Sessions auf der FRITZ!Box zurückbleiben.
   */
  async connect(dto: ConnectHeatingDto) {
    const config: FritzBoxConfig = {
      id: dto.id,
      title: dto.title,
      ahaUrl: dto.ahaUrl,
      ahaUser: dto.ahaUser,
      ahaPassword: dto.ahaPassword,
    };

    const fritzBox = await this.diagnostic(async () => {
      const box = new FritzBox(config);
      await box.connect();
      return box;
    });

    const previous = this.fritzBox;
    this.fritzBox = fritzBox;

    if (previous && previous !== fritzBox) {
      await previous.disconnect().catch((error: unknown) => {
        this.logger.warn(
          `Previous diagnostic FRITZ!Box session could not be closed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    return {
      connected: fritzBox.isConnected(),
      state: fritzBox.getState(),
      id: fritzBox.config.id,
      title: fritzBox.config.title,
    };
  }

  testConnection() {
    const fritzBox = this.requireConfigured();

    return {
      connected: fritzBox.isConnected(),
      state: fritzBox.getState(),
      id: fritzBox.config.id,
      title: fritzBox.config.title,
    };
  }

  async getDevices() {
    const fritzBox = this.requireConnected();

    return this.diagnostic(() => fritzBox.listDevices());
  }

  async disconnect() {
    if (!this.fritzBox) {
      return {
        connected: false,
      };
    }

    const fritzBox = this.fritzBox;
    this.fritzBox = undefined;

    await this.diagnostic(() => fritzBox.disconnect());

    return {
      connected: false,
      state: fritzBox.getState(),
    };
  }

  async getDevice(ain: string) {
    const fritzBox = this.requireConnected();

    return this.diagnostic(() => fritzBox.devices.get(ain));
  }

  async getThermostats() {
    const fritzBox = this.requireConnected();

    const devices = await this.diagnostic(() => fritzBox.devices.list());

    return devices
      .filter((device) => device.capabilities.targetTemperature)
      .map((device) => ({
        ain: device.ain,
        name: device.name,
        type: device.type,
        present: device.present,
        capabilities: device.capabilities,
        ...(device.manufacturer === undefined
          ? {}
          : { manufacturer: device.manufacturer }),
        ...(device.product === undefined ? {} : { product: device.product }),
        ...(device.batteryLow === undefined
          ? {}
          : { batteryLow: device.batteryLow }),
      }));
  }

  async isGroup(ain: string) {
    const fritzBox = this.requireConnected();

    return this.diagnostic(() => fritzBox.isGroup(ain));
  }

  async getGroups() {
    const fritzBox = this.requireConnected();

    return this.diagnostic(() => fritzBox.listGroups());
  }

  /*
   * Diagnose-Eingriff: setzt den Sollwert direkt, ohne den persistierten
   * Heizzustand (room.heated) der kalendergesteuerten Heizung zu ändern.
   */
  async setTemperature(ain: string, temperature: number) {
    const fritzBox = this.requireConnected();

    await this.diagnostic(() =>
      fritzBox.thermostats.get(ain).setTemperature(temperature),
    );

    return {
      ain,
      temperature,
    };
  }

  async getTemperature(ain: string) {
    const fritzBox = this.requireConnected();

    return this.diagnostic(async () => {
      if (await fritzBox.isGroup(ain)) {
        return fritzBox.groups.getTemperature(ain);
      }

      return fritzBox.thermostats.get(ain).getStatus();
    });
  }

  private requireConfigured(): FritzBox {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    return this.fritzBox;
  }

  private requireConnected(): FritzBox {
    const fritzBox = this.requireConfigured();

    if (!fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    return fritzBox;
  }

  /* Bibliotheksfehler als passende HTTP-Fehler statt HTTP 500 melden. */
  private async diagnostic<T>(action: () => T | Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toDiagnosticHttpError(error);
    }
  }
}
