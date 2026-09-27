import { DeviceType } from '../devices/DeviceType.js';
import { TemperatureConverter } from '../thermostats/TemperatureConverter.js';
export class DefaultGroupService {
    aha;
    parser;
    devices;
    constructor(aha, parser, devices) {
        this.aha = aha;
        this.parser = parser;
        this.devices = devices;
    }
    async list() {
        const response = await this.aha.execute({
            kind: 'getDeviceListInfos',
        });
        return this.parser.parseGroupList(response);
    }
    async isGroup(ain) {
        const groups = await this.list();
        return groups.some((group) => group.ain === ain);
    }
    async getTemperature(ain) {
        const groups = await this.list();
        const group = groups.find((item) => item.ain === ain);
        if (!group) {
            throw new Error(`Unknown group AIN: ${ain}`);
        }
        if (group.members.length === 0) {
            throw new Error(`Group ${ain} has no members`);
        }
        const devices = await this.devices.list();
        // group.members enthält Device-IDs, nicht AINs.
        const thermostats = group.members
            .map((memberId) => devices.find((device) => device.id === memberId && device.type === DeviceType.Thermostat))
            .filter((device) => device !== undefined);
        if (thermostats.length === 0) {
            throw new Error(`Group ${ain} has no thermostat members`);
        }
        const values = await Promise.all(thermostats.map(async (thermostat) => {
            const [temperatureResponse, targetResponse] = await Promise.all([
                this.aha.execute({
                    kind: 'getTemperature',
                    ain: thermostat.ain,
                }),
                this.aha.execute({
                    kind: 'getTargetTemperature',
                    ain: thermostat.ain,
                }),
            ]);
            const temperature = this.parser.parseScalar(temperatureResponse);
            const targetTemperature = this.parser.parseScalar(targetResponse);
            return {
                temperature: temperature / 10,
                targetTemperature: TemperatureConverter.fromAhaTemperature(targetTemperature),
            };
        }));
        const temperature = values.reduce((sum, value) => sum + value.temperature, 0) / values.length;
        const targetTemperature = values.reduce((sum, value) => sum + value.targetTemperature, 0) /
            values.length;
        return {
            ain: group.ain,
            name: group.name,
            temperature,
            targetTemperature,
            members: thermostats.map((device) => device.ain),
        };
    }
}
//# sourceMappingURL=GroupService.js.map