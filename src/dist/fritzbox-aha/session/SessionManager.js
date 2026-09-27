import { RetryPolicy } from '../transport/RetryPolicy.js';
import { ConnectionError, SessionError } from '../errors/FritzBoxError.js';
export class DefaultSessionManager {
    authenticator;
    ahaUrl;
    transport;
    retry;
    sid;
    loginPromise;
    constructor(authenticator, ahaUrl, transport, retry = new RetryPolicy()) {
        this.authenticator = authenticator;
        this.ahaUrl = ahaUrl;
        this.transport = transport;
        this.retry = retry;
    }
    async getSid() {
        if (this.sid)
            return this.sid;
        if (!this.loginPromise) {
            this.loginPromise = this.authenticator
                .authenticate()
                .then((session) => {
                if (!session.sid || /^0+$/.test(session.sid)) {
                    throw new SessionError('Authenticator returned an invalid session');
                }
                this.sid = session.sid;
                return session.sid;
            })
                .finally(() => {
                this.loginPromise = undefined;
            });
        }
        return this.loginPromise;
    }
    invalidate() {
        this.sid = undefined;
    }
    isAuthenticated() {
        return this.sid !== undefined;
    }
    async logout() {
        const sid = this.sid;
        this.sid = undefined;
        if (!sid)
            return;
        try {
            const base = new URL(this.ahaUrl);
            base.pathname = '/login_sid.lua';
            base.search = `logout=1&sid=${encodeURIComponent(sid)}`;
            const response = await this.retry.get(this.transport, base.toString());
            if (response.status < 200 || response.status >= 300) {
                throw new SessionError(`FRITZ!Box logout failed with HTTP ${response.status}`);
            }
        }
        catch (error) {
            if (error instanceof SessionError || error instanceof ConnectionError)
                throw error;
            throw new SessionError('FRITZ!Box logout failed', { cause: error });
        }
    }
}
//# sourceMappingURL=SessionManager.js.map