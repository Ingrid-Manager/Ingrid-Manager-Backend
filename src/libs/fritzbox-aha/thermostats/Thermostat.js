import { EventEmitter } from 'node:events';
import { ConfigurationError, DeviceUnavailableError, InvalidTemperatureError, } from '../errors/FritzBoxError.js';
import { TemperatureConverter } from './TemperatureConverter.js';
export class ThermostatImpl extends EventEmitter {
    ain;
    name;
    aha;
    parser;
    resolveDevice;
    timer;
    lastStatus;
    inFlight = false;
    pollingGeneration = 0;
    constructor(ain, name, aha, parser, resolveDevice) {
        super();
        this.ain = ain;
        this.name = name;
        this.aha = aha;
        this.parser = parser;
        this.resolveDevice = resolveDevice;
    }
    async getStatus() {
        const device = await this.resolveDevice();
        if (device && !device.present) {
            throw new DeviceUnavailableError(`Thermostat ${this.ain} is not reachable`);
        }
        const [temperature, target, comfort, reduction] = await Promise.all([
            this.scalarMeasuredTemperature({ kind: 'getTemperature', ain: this.ain }),
            this.scalarHkrTemperature({
                kind: 'getTargetTemperature',
                ain: this.ain,
            }),
            this.scalarHkrTemperature({
                kind: 'getComfortTemperature',
                ain: this.ain,
            }),
            this.scalarHkrTemperature({
                kind: 'getReductionTemperature',
                ain: this.ain,
            }),
        ]);
        return {
            ain: this.ain,
            name: this.name,
            temperature: temperature / 10,
            targetTemperature: TemperatureConverter.fromAhaTemperature(target),
            comfortTemperature: TemperatureConverter.fromAhaTemperature(comfort),
            reductionTemperature: TemperatureConverter.fromAhaTemperature(reduction),
            ...(device?.present === undefined ? {} : { reachable: device.present }),
            ...(device?.batteryLow === undefined
                ? {}
                : { batteryLow: device.batteryLow }),
            lastUpdated: new Date(),
        };
    }
    async setTemperature(temperature) {
        const value = TemperatureConverter.toAhaTargetTemperature(temperature);
        const response = await this.aha.execute({
            kind: 'setTargetTemperature',
            ain: this.ain,
            value,
        });
        this.parser.parseScalar(response);
    }
    startPolling(options) {
        if (!Number.isInteger(options.interval) || options.interval < 1000) {
            throw new ConfigurationError('Polling interval must be an integer >= 1000 ms');
        }
        this.stopPolling();
        const generation = ++this.pollingGeneration;
        this.timer = setInterval(() => {
            if (this.inFlight)
                return;
            this.inFlight = true;
            void this.getStatus()
                .then((status) => {
                if (generation !== this.pollingGeneration)
                    return;
                const previous = this.lastStatus;
                this.lastStatus = status;
                if (!previous || hasMeaningfulStatusChange(previous, status)) {
                    this.emit('statusChanged', status);
                }
            })
                .catch((error) => {
                if (generation === this.pollingGeneration)
                    this.emit('error', error);
            })
                .finally(() => {
                this.inFlight = false;
            });
        }, options.interval);
    }
    stopPolling() {
        this.pollingGeneration++;
        if (this.timer)
            clearInterval(this.timer);
        this.timer = undefined;
    }
    off(event, listener) {
        super.off(event, listener);
        return this;
    }
    async scalarMeasuredTemperature(command) {
        const value = this.parser.parseScalar(await this.aha.execute(command));
        if (value === 9999 || !Number.isFinite(value) || value < 0) {
            throw new InvalidTemperatureError('Invalid or unavailable AHA measured temperature');
        }
        return value;
    }
    async scalarHkrTemperature(command) {
        const value = this.parser.parseScalar(await this.aha.execute(command));
        if (value === 253 || value === 254) {
            throw new InvalidTemperatureError('AHA thermostat sentinel is not a Celsius temperature');
        }
        return value;
    }
}
function hasMeaningfulStatusChange(a, b) {
    return (a.temperature !== b.temperature ||
        a.targetTemperature !== b.targetTemperature ||
        a.reachable !== b.reachable ||
        a.batteryLow !== b.batteryLow);
}
//# sourceMappingURL=Thermostat.js.map