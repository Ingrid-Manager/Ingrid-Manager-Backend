import { ProtocolError } from '../errors/FritzBoxError.js';
import { hasField, readBoolean, readOptionalString, readString, sharedXmlParser, } from './xml-helpers.js';
import { DeviceType } from '../devices/DeviceType.js';
const HKR_BIT = 6;
const TEMPERATURE_BIT = 8;
const SWITCH_BIT = 9;
const ACTOR_BIT = 15;
export class AhaResponseParser {
    parseScalar(response) {
        if (response.status < 200 || response.status >= 300) {
            throw new ProtocolError(`AHA request failed with HTTP ${response.status}`);
        }
        const value = Number(response.body.trim());
        if (!Number.isFinite(value))
            throw new ProtocolError('AHA response was not numeric');
        return value;
    }
    parseDeviceList(response) {
        if (response.status < 200 || response.status >= 300) {
            throw new ProtocolError(`AHA request failed with HTTP ${response.status}`);
        }
        try {
            const parsed = sharedXmlParser.parse(response.body);
            const root = parsed;
            const list = root.devicelist;
            const raw = list?.device;
            if (raw === undefined)
                return [];
            const items = Array.isArray(raw) ? raw : [raw];
            return items.map((item) => this.mapDevice(item));
        }
        catch (error) {
            if (error instanceof ProtocolError)
                throw error;
            throw new ProtocolError('Invalid AHA device-list XML', { cause: error });
        }
    }
    parseGroupList(response) {
        if (response.status < 200 || response.status >= 300) {
            throw new ProtocolError(`AHA request failed with HTTP ${response.status}`);
        }
        try {
            const parsed = sharedXmlParser.parse(response.body);
            const root = parsed;
            const list = root.devicelist;
            const raw = list?.group;
            if (raw === undefined)
                return [];
            const items = Array.isArray(raw) ? raw : [raw];
            return items.map((item) => this.mapGroup(item));
        }
        catch (error) {
            if (error instanceof ProtocolError)
                throw error;
            throw new ProtocolError('Invalid AHA group-list XML', { cause: error });
        }
    }
    mapDevice(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new ProtocolError('Invalid AHA device object');
        }
        const record = raw;
        const id = readString(record, 'id');
        const ain = readString(record, 'identifier');
        const name = readString(record, 'name', ain);
        const manufacturer = readOptionalString(record, 'manufacturer');
        const product = readOptionalString(record, 'productname');
        const present = readBoolean(record, 'present', false);
        const mask = parseFunctionBitmask(record.functionbitmask);
        const capabilities = {
            temperature: Boolean(mask & (1 << TEMPERATURE_BIT)) ||
                hasField(record, 'temperature'),
            targetTemperature: Boolean(mask & (1 << HKR_BIT)) || hasField(record, 'hkrtsoll'),
            comfortTemperature: Boolean(mask & (1 << HKR_BIT)) || hasField(record, 'hkrkomfort'),
            reductionTemperature: Boolean(mask & (1 << HKR_BIT)) || hasField(record, 'hkrabsenk'),
        };
        let type = DeviceType.Unknown;
        if (mask & (1 << HKR_BIT) ||
            hasField(record, 'hkrtsoll') ||
            hasField(record, 'hkrkomfort') ||
            hasField(record, 'hkrabsenk')) {
            type = DeviceType.Thermostat;
        }
        else if (mask & (1 << SWITCH_BIT) || mask & (1 << ACTOR_BIT)) {
            type = DeviceType.Switch;
        }
        else if (mask & (1 << TEMPERATURE_BIT) ||
            hasField(record, 'temperature')) {
            type = DeviceType.Sensor;
        }
        return {
            id,
            ain,
            name,
            ...(manufacturer === undefined ? {} : { manufacturer }),
            ...(product === undefined ? {} : { product }),
            type,
            present,
            capabilities,
            ...(hasField(record, 'batterylow')
                ? { batteryLow: readBoolean(record, 'batterylow', false) }
                : {}),
        };
    }
    mapGroup(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new ProtocolError('Invalid AHA group object');
        }
        const record = raw;
        const ain = readString(record, 'identifier');
        const name = readString(record, 'name', ain);
        return {
            ain,
            name,
            members: parseGroupMembers(record),
        };
    }
}
function parseFunctionBitmask(value) {
    if (value === undefined)
        return 0;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new ProtocolError('Invalid AHA functionbitmask');
    }
    return n;
}
function parseGroupMembers(record) {
    const groupinfo = record.groupinfo;
    if (!groupinfo || typeof groupinfo !== 'object' || Array.isArray(groupinfo)) {
        return [];
    }
    const members = groupinfo.members;
    if (typeof members !== 'string' || members.trim() === '') {
        return [];
    }
    return members
        .split(',')
        .map((member) => member.trim())
        .filter((member) => member.length > 0);
}
//# sourceMappingURL=AhaResponseParser.js.map