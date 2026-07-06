import { Injectable } from '@nestjs/common';
import { DeviceService } from './device.service';
import { AvmConnection } from '../interfaces/avm-connection.interface';

@Injectable()
export class DiscoveryService {
  constructor(private readonly deviceService: DeviceService) {}

  async findThermostats(connection: AvmConnection) {
    const devices = await this.deviceService.getDevices(connection);

    return devices.filter((d) => d.hasThermostat);
  }
}
