export class TemperatureMapper {
  static parse(device: any): number {
    return Number(device.temperature?.celsius ?? 0) / 10;
  }
}
