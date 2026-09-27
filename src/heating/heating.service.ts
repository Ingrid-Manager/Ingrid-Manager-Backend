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

  async connect(dto: ConnectHeatingDto) {
    const config: FritzBoxConfig = {
      id: dto.id,
      title: dto.title,
      ahaUrl: dto.ahaUrl,
      ahaUser: dto.ahaUser,
      ahaPassword: dto.ahaPassword,
    };

    const fritzBox = new FritzBox(config);

    await fritzBox.connect();

    this.fritzBox = fritzBox;

    return {
      connected: fritzBox.isConnected(),
      state: fritzBox.getState(),
      id: fritzBox.config.id,
      title: fritzBox.config.title,
    };
  }

  testConnection() {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    return {
      connected: this.fritzBox.isConnected(),
      state: this.fritzBox.getState(),
      id: this.fritzBox.config.id,
      title: this.fritzBox.config.title,
    };
  }

  async getDevices() {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    return this.fritzBox.listDevices();
  }

  async disconnect() {
    if (!this.fritzBox) {
      return {
        connected: false,
      };
    }

    await this.fritzBox.disconnect();

    const result = {
      connected: false,
      state: this.fritzBox.getState(),
    };

    this.fritzBox = undefined;

    return result;
  }

  async getDevice(ain: string) {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    return this.fritzBox.devices.get(ain);
  }

  async getThermostats() {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    const devices = await this.fritzBox.devices.list();

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

  isGroup(ain: string) {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    return this.fritzBox.isGroup(ain);
  }

  getGroups() {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    return this.fritzBox.listGroups();
  }

  async setTemperature(ain: string, temperature: number) {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No Fritz!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    const thermostat = this.fritzBox.thermostats.get(ain);

    await thermostat.setTemperature(temperature);

    return {
      ain,
      temperature,
    };
  }

  async getTemperature(ain: string) {
    if (!this.fritzBox) {
      throw new ServiceUnavailableException(
        'No FRITZ!Box connection configured',
      );
    }

    if (!this.fritzBox.isConnected()) {
      throw new ServiceUnavailableException('FRITZ!Box is not connected');
    }

    if (await this.fritzBox.isGroup(ain)) {
      return this.fritzBox.groups.getTemperature(ain);
    }

    const thermostat = this.fritzBox.thermostats.get(ain);

    return thermostat.getStatus();
  }
}
