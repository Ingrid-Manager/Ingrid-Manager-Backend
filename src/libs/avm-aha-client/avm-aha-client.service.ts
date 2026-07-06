import { Injectable } from '@nestjs/common';
import { DeviceService } from './services/device.service';
import { ThermostatService } from './services/thermostat.service';
import { AvmConnection } from './interfaces/avm-connection.interface';
import { DiscoveryService } from './services/discovery.service';
import { HealthService } from './services/health.service';
@Injectable()
export class AvmAhaClientService {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly thermostatService: ThermostatService,
    private readonly discoveryService: DiscoveryService,
    private readonly healthService: HealthService,
  ) {}

  async getDevices(connection: AvmConnection) {
    return this.deviceService.getDevices(connection);
  }

  async getDevice(connection: AvmConnection, ain: string) {
    return this.deviceService.getDevice(connection, ain);
  }

  async setTargetTemperature(
    connection: AvmConnection,
    ain: string,
    temperature: number,
  ) {
    return this.thermostatService.setTargetTemperature(
      connection,
      ain,
      temperature,
    );
  }

  async getThermostat(connection: AvmConnection, ain: string) {
    return this.thermostatService.getThermostat(connection, ain);
  }

  async findThermostats(connection: AvmConnection) {
    return this.discoveryService.findThermostats(connection);
  }

  async healthCheck(connection: AvmConnection): Promise<boolean> {
    return this.healthService.ping(connection);
  }

  async validateCredentials(connection: AvmConnection): Promise<boolean> {
    return this.healthService.validateCredentials(connection);
  }
}
