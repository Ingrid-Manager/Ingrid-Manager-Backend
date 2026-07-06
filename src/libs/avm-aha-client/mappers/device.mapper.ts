import { DeviceDto } from '../dto/device.dto';
import { ThermostatMapper } from './thermostat.mapper';

export class DeviceMapper {
  static fromAvm(device: any): DeviceDto {
    return {
      ain: device.identifier,
      identifier: device.identifier,
      name: device.name,
      manufacturer: device.manufacturer,
      productName: device.productname,
      fwVersion: device.fwversion,
      present: device.present === '1',
      functions: Number(device.functionbitmask),
      hasThermostat: !!device.hkr,
      hasSwitch: !!device.switch,
      hasTemperatureSensor: !!device.temperature,
      thermostat: device.hkr ? ThermostatMapper.fromAvm(device) : undefined,
    };
  }
}
