import { ThermostatDto } from '../dto/thermostat.dto';
import { TemperatureUtil } from '../utils/temperature.util';

export class ThermostatMapper {
  static fromAvm(device: any): ThermostatDto {
    return {
      currentTemperature: Number(device.temperature?.celsius ?? 0) / 10,
      targetTemperature: TemperatureUtil.fromAvm(Number(device.hkr.tsoll)),
      comfortTemperature: TemperatureUtil.fromAvm(Number(device.hkr.comf_temp)),
      ecoTemperature: TemperatureUtil.fromAvm(Number(device.hkr.eco_temp)),
      batteryLow: device.batterylow === '1' || device.alert?.state === '1',
      batteryLevel: device.battery ? Number(device.battery) : undefined,
      windowOpen: device.hkr.windowopenactive === '1',
      summerActive: device.hkr.summeractive === '1',
      holidayActive: device.hkr.holidayactive === '1',
      deviceLock: device.hkr.devicelock === '1',
      userLock: device.hkr.lock === '1',
    };
  }
}
