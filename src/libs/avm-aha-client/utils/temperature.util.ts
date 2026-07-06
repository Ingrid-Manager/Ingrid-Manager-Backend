export class TemperatureUtil {
  static toAvm(value: number): number {
    if (value <= 8) return 253;

    if (value >= 28) return 56;

    return Math.round(value * 2);
  }

  static fromAvm(value: number): number {
    if (value === 253) return 8;

    if (value === 254) return 28;

    return value / 2;
  }

  static validateTemperature(temperature: number): void {
    if (temperature < 8 || temperature > 28) {
      throw new Error('Temperature must be between 8 and 28 degrees');
    }
  }
}
