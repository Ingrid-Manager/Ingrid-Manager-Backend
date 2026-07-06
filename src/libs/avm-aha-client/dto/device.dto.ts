import { ThermostatDto } from './thermostat.dto';

export class DeviceDto {
  ain: string;
  identifier: string;
  name: string;
  manufacturer?: string;
  productName?: string;
  fwVersion?: string;
  present: boolean;
  functions: number;
  hasThermostat: boolean;
  hasSwitch: boolean;
  hasTemperatureSensor: boolean;
  thermostat?: ThermostatDto;
}
