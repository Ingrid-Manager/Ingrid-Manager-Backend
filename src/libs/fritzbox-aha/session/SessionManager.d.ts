import type { FritzBoxAuthenticator } from '../authentication/FritzBoxAuthenticator.js';
import type { HttpTransport } from '../transport/HttpTransport.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
export interface SessionManager {
    getSid(): Promise<string>;
    invalidate(): void;
    isAuthenticated(): boolean;
    logout(): Promise<void>;
}
export declare class DefaultSessionManager implements SessionManager {
    private readonly authenticator;
    private readonly ahaUrl;
    private readonly transport;
    private readonly retry;
    private sid;
    private loginPromise;
    constructor(authenticator: FritzBoxAuthenticator, ahaUrl: string, transport: HttpTransport, retry?: RetryPolicy);
    getSid(): Promise<string>;
    invalidate(): void;
    isAuthenticated(): boolean;
    logout(): Promise<void>;
}
//# sourceMappingURL=SessionManager.d.ts.map