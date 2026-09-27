import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { FritzBox, FritzBoxConfig } from '../libs/fritzbox-aha/index.js';

import type { ConnectHeatingDto } from './dto/connect-heating.dto';

@Injectable()
export class HeatingService {
  private fritzBox?: FritzBox;

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
