import { DeviceFunction } from '../enums/device-function.enum';

export function isThermostat(functionBitmask: number): boolean {
  return (functionBitmask & DeviceFunction.THERMOSTAT) > 0;
}
