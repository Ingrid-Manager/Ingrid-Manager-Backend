import { InvalidTemperatureError } from '../errors/FritzBoxError.js';
export class TemperatureConverter {
    static fromAhaTemperature(value) {
        if (!Number.isInteger(value) || value < 16 || value > 56) {
            if (value === 254 || value === 253)
                throw new InvalidTemperatureError('AHA ON/OFF value is not a Celsius temperature');
            throw new InvalidTemperatureError('Invalid AHA thermostat temperature');
        }
        return value / 2;
    }
    static toAhaTargetTemperature(value) {
        if (!Number.isFinite(value) || value < 8 || value > 28) {
            throw new InvalidTemperatureError('Thermostat temperature must be between 8 and 28 °C');
        }
        const doubled = Math.round(value * 2);
        const normalized = doubled / 2;
        if (Math.abs(normalized - value) > Number.EPSILON * Math.max(1, Math.abs(value))) {
            throw new InvalidTemperatureError('Thermostat temperature must use 0.5 °C steps');
        }
        return doubled;
    }
}
//# sourceMappingURL=TemperatureConverter.js.map