import type { HttpResponse, HttpTransport, RequestOptions } from './HttpTransport.js';
export interface RetryPolicyOptions {
    readonly maxAttempts?: number;
    readonly baseDelayMs?: number;
}
export declare class RetryPolicy {
    private readonly maxAttempts;
    private readonly baseDelayMs;
    constructor(options?: RetryPolicyOptions);
    get(transport: HttpTransport, url: string, options?: RequestOptions): Promise<HttpResponse>;
    post(transport: HttpTransport, url: string, options?: RequestOptions): Promise<HttpResponse>;
    private execute;
    private retryableStatus;
    private mapNetworkError;
    private delay;
}
//# sourceMappingURL=RetryPolicy.d.ts.map