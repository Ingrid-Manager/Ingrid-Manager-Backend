export interface RequestOptions {
    readonly signal?: AbortSignal;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string | Uint8Array;
    readonly timeoutMs?: number;
}
export interface HttpResponse {
    readonly status: number;
    readonly headers: Headers;
    readonly body: string;
}
export interface HttpTransport {
    get(url: string, options?: RequestOptions): Promise<HttpResponse>;
    post(url: string, options?: RequestOptions): Promise<HttpResponse>;
}
export interface FetchTransportOptions {
    readonly defaultTimeoutMs?: number;
    readonly userAgent?: string;
}
export declare class FetchHttpTransport implements HttpTransport {
    private readonly defaultTimeoutMs;
    private readonly userAgent;
    constructor(options?: FetchTransportOptions);
    get(url: string, options?: RequestOptions): Promise<HttpResponse>;
    post(url: string, options?: RequestOptions): Promise<HttpResponse>;
    private request;
}
//# sourceMappingURL=HttpTransport.d.ts.map