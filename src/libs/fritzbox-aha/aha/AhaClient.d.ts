import type { SessionManager } from '../session/SessionManager.js';
import type { HttpTransport } from '../transport/HttpTransport.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
import type { AhaCommand, AhaResponse } from './AhaCommand.js';
export declare class AhaClient {
    private readonly session;
    private readonly transport;
    private readonly retry;
    private readonly endpoint;
    constructor(ahaUrl: string, session: SessionManager, transport: HttpTransport, retry?: RetryPolicy);
    execute(command: AhaCommand): Promise<AhaResponse>;
    private buildUrl;
}
//# sourceMappingURL=AhaClient.d.ts.map