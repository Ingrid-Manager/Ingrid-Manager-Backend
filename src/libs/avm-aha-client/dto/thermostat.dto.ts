export class ThermostatDto {
  currentTemperature: number;
  targetTemperature: number;
  comfortTemperature: number;
  ecoTemperature: number;
  batteryLow: boolean;
  batteryLevel?: number;
  windowOpen: boolean;
  summerActive: boolean;
  holidayActive: boolean;
  deviceLock: boolean;
  userLock: boolean;
}
