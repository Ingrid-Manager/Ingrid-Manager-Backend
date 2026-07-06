import { DeviceDto } from '../dto/device.dto';
import { XmlParser } from './xml.parser';
import { DeviceMapper } from '../mappers/device.mapper';

export class DeviceListParser {
  static async parse(xml: string): Promise<DeviceDto[]> {
    const result = await XmlParser.parse(xml);

    let devices = result?.devicelist?.device;

    if (!devices) {
      return [];
    }

    if (!Array.isArray(devices)) {
      devices = [devices];
    }

    return devices.map(DeviceMapper.fromAvm);
  }
}
