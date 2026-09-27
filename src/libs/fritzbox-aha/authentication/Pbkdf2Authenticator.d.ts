import type { FritzBoxAuthenticator, Session } from './FritzBoxAuthenticator.js';
import type { HttpTransport } from '../transport/HttpTransport.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
export declare class Pbkdf2Authenticator implements FritzBoxAuthenticator {
    private readonly username;
    private readonly password;
    private readonly transport;
    private readonly retry;
    private readonly loginUrl;
    constructor(ahaUrl: string, username: string, password: string, transport: HttpTransport, retry?: RetryPolicy);
    authenticate(): Promise<Session>;
    private readChallenge;
    private readSid;
    private readBlockTime;
}
export declare function calculatePbkdf2Response(challenge: string, password: string): string;
//# sourceMappingURL=Pbkdf2Authenticator.d.ts.map