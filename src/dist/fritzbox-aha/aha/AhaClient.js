import { ProtocolError, SessionError, UnsupportedFeatureError } from '../errors/FritzBoxError.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
export class AhaClient {
    session;
    transport;
    retry;
    endpoint;
    constructor(ahaUrl, session, transport, retry = new RetryPolicy()) {
        this.session = session;
        this.transport = transport;
        this.retry = retry;
        const base = new URL(ahaUrl);
        base.pathname = '/webservices/homeautoswitch.lua';
        base.search = '';
        this.endpoint = base.toString();
    }
    async execute(command) {
        if (command.kind === 'setTargetTemperature' &&
            (!Number.isInteger(command.value) || command.value < 16 || command.value > 56)) {
            throw new ProtocolError('AHA target temperature must be an integer value between 16 and 56');
        }
        const sid = await this.session.getSid();
        const response = await this.retry.get(this.transport, this.buildUrl(command, sid));
        if (response.status === 401 || response.status === 403) {
            this.session.invalidate();
            const recovered = await this.session.getSid();
            const retryResponse = await this.retry.get(this.transport, this.buildUrl(command, recovered));
            if (retryResponse.status === 401 || retryResponse.status === 403) {
                this.session.invalidate();
                throw new SessionError('FRITZ!Box rejected the authenticated session');
            }
            return { status: retryResponse.status, body: retryResponse.body, command };
        }
        return { status: response.status, body: response.body, command };
    }
    buildUrl(command, sid) {
        const params = new URLSearchParams({ sid });
        switch (command.kind) {
            case 'getDeviceListInfos':
                params.set('switchcmd', 'getdevicelistinfos');
                break;
            case 'getTemperature':
                params.set('switchcmd', 'gettemperature');
                params.set('ain', command.ain);
                break;
            case 'getTargetTemperature':
                params.set('switchcmd', 'gethkrtsoll');
                params.set('ain', command.ain);
                break;
            case 'getComfortTemperature':
                params.set('switchcmd', 'gethkrkomfort');
                params.set('ain', command.ain);
                break;
            case 'getReductionTemperature':
                params.set('switchcmd', 'gethkrabsenk');
                params.set('ain', command.ain);
                break;
            case 'setTargetTemperature':
                params.set('switchcmd', 'sethkrtsoll');
                params.set('ain', command.ain);
                params.set('param', String(command.value));
                break;
            default:
                return assertNever(command);
        }
        return `${this.endpoint}?${params.toString()}`;
    }
}
function assertNever(value) {
    throw new UnsupportedFeatureError(`Unsupported AHA command: ${String(value)}`);
}
//# sourceMappingURL=AhaClient.js.map