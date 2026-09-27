import { pbkdf2Sync } from 'node:crypto';
import { AuthenticationError, ProtocolError } from '../errors/FritzBoxError.js';
import { readNumber, readString, sharedXmlParser } from '../aha/xml-helpers.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
export class Pbkdf2Authenticator {
    username;
    password;
    transport;
    retry;
    loginUrl;
    constructor(ahaUrl, username, password, transport, retry = new RetryPolicy()) {
        this.username = username;
        this.password = password;
        this.transport = transport;
        this.retry = retry;
        const base = new URL(ahaUrl);
        base.pathname = '/login_sid.lua';
        base.search = '';
        this.loginUrl = base.toString();
    }
    async authenticate() {
        const initial = await this.retry.get(this.transport, `${this.loginUrl}?version=2`);
        if (initial.status < 200 || initial.status >= 300) {
            throw new AuthenticationError('FRITZ!Box login challenge request failed');
        }
        const challenge = this.readChallenge(initial.body);
        const blockTime = this.readBlockTime(initial.body);
        if (blockTime > 0) {
            throw new AuthenticationError(`FRITZ!Box login is temporarily blocked for ${blockTime} seconds`);
        }
        if (!challenge.startsWith('2$')) {
            throw new AuthenticationError('FRITZ!Box does not expose the required PBKDF2 challenge');
        }
        const response = calculatePbkdf2Response(challenge, this.password);
        const body = new URLSearchParams({
            username: this.username,
            response,
        }).toString();
        const login = await this.retry.post(this.transport, `${this.loginUrl}?version=2`, {
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        });
        if (login.status < 200 || login.status >= 300) {
            throw new AuthenticationError('FRITZ!Box authentication request failed');
        }
        const sid = this.readSid(login.body);
        if (!sid || /^0+$/.test(sid)) {
            throw new AuthenticationError('FRITZ!Box authentication failed');
        }
        return { sid };
    }
    readChallenge(xml) {
        try {
            const parsed = sharedXmlParser.parse(xml);
            const root = asRecord(parsed);
            const info = asRecord(root.SessionInfo);
            return readString(info, 'Challenge');
        }
        catch (error) {
            if (error instanceof ProtocolError)
                throw error;
            throw new ProtocolError('FRITZ!Box login response did not contain a valid challenge', {
                cause: error,
            });
        }
    }
    readSid(xml) {
        try {
            const parsed = sharedXmlParser.parse(xml);
            const root = asRecord(parsed);
            const info = asRecord(root.SessionInfo);
            return readString(info, 'SID');
        }
        catch (error) {
            if (error instanceof ProtocolError)
                throw error;
            throw new ProtocolError('FRITZ!Box login response did not contain a valid SID', {
                cause: error,
            });
        }
    }
    readBlockTime(xml) {
        try {
            const parsed = sharedXmlParser.parse(xml);
            const root = asRecord(parsed);
            const info = asRecord(root.SessionInfo);
            return Math.max(0, readNumber(info, 'BlockTime', 0));
        }
        catch (error) {
            if (error instanceof ProtocolError)
                throw error;
            throw new ProtocolError('FRITZ!Box login response contained an invalid BlockTime', {
                cause: error,
            });
        }
    }
}
function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ProtocolError('Invalid FRITZ!Box login XML structure');
    }
    return value;
}
export function calculatePbkdf2Response(challenge, password) {
    const parts = challenge.split('$');
    if (parts.length !== 5 || parts[0] !== '2') {
        throw new AuthenticationError('Unsupported PBKDF2 challenge format');
    }
    const iter1 = parseIteration(parts[1]);
    const salt1 = parts[2];
    const iter2 = parseIteration(parts[3]);
    const salt2 = parts[4];
    if (!salt1 || !salt2)
        throw new AuthenticationError('Invalid PBKDF2 challenge');
    const hash1 = pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from(salt1, 'hex'), iter1, 32, 'sha256');
    const hash2 = pbkdf2Sync(hash1, Buffer.from(salt2, 'hex'), iter2, 32, 'sha256');
    return `${salt2}$${hash2.toString('hex')}`;
}
function parseIteration(value) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) {
        throw new AuthenticationError('Invalid PBKDF2 iteration count');
    }
    return n;
}
//# sourceMappingURL=Pbkdf2Authenticator.js.map