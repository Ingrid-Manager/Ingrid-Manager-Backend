import { XMLParser } from 'fast-xml-parser';
import { ProtocolError } from '../errors/FritzBoxError.js';
export const sharedXmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
});
export function readString(record, key, fallback) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0)
        return value;
    if (fallback !== undefined)
        return fallback;
    throw new ProtocolError(`XML field "${key}" is missing`);
}
export function readOptionalString(record, key) {
    const value = record[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
export function readBoolean(record, key, fallback) {
    const value = record[key];
    if (value === undefined)
        return fallback;
    if (value === '1' || value === 1 || value === true)
        return true;
    if (value === '0' || value === 0 || value === false)
        return false;
    throw new ProtocolError(`XML field "${key}" is invalid`);
}
export function hasField(record, key) {
    return Object.prototype.hasOwnProperty.call(record, key);
}
export function readNumber(record, key, fallback) {
    const value = record[key];
    if (value === undefined && fallback !== undefined)
        return fallback;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number))
        throw new ProtocolError(`XML field "${key}" is not numeric`);
    return number;
}
//# sourceMappingURL=xml-helpers.js.map