export class BatteryMapper {
  static level(device: any): number | undefined {
    return device.battery ? Number(device.battery) : undefined;
  }

  static isLow(device: any): boolean {
    return device.alert?.state === '1';
  }
}
