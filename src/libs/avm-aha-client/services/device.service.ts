import { Injectable } from '@nestjs/common';
import { AvmConnection } from '../interfaces/avm-connection.interface';
import { DeviceDto } from '../dto/device.dto';
import { HttpService } from './http.service';
import { XmlParser } from '../parsers/xml.parser';
import { DeviceMapper } from '../mappers/device.mapper';

@Injectable()
export class DeviceService {
  constructor(private readonly httpService: HttpService) {}

  async getDevices(connection: AvmConnection): Promise<DeviceDto[]> {
    const xml = await this.httpService.call(connection, 'getdevicelistinfos');
    const result = await XmlParser.parse(xml);
    let devices = result.devicelist.device;

    if (!Array.isArray(devices)) {
      devices = [devices];
    }

    return devices.map(DeviceMapper.fromAvm);
  }

  async getDevice(
    connection: AvmConnection,
    ain: string,
  ): Promise<DeviceDto | undefined> {
    const devices = await this.getDevices(connection);

    return devices.find((device) => device.ain === ain);
  }
}
