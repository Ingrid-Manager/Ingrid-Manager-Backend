import { TimeoutError } from '../errors/FritzBoxError.js';
export class FetchHttpTransport {
    defaultTimeoutMs;
    userAgent;
    constructor(options = {}) {
        this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
        this.userAgent = options.userAgent ?? 'fritzbox-aha/0.1';
    }
    get(url, options = {}) {
        return this.request('GET', url, options);
    }
    post(url, options = {}) {
        return this.request('POST', url, options);
    }
    async request(method, url, options) {
        const controller = new AbortController();
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort('timeout');
        }, options.timeoutMs ?? this.defaultTimeoutMs);
        const signal = options.signal
            ? AbortSignal.any([controller.signal, options.signal])
            : controller.signal;
        try {
            const requestInit = {
                method,
                headers: {
                    'user-agent': this.userAgent,
                    ...(options.headers ?? {}),
                },
                signal,
            };
            if (method === 'POST' && options.body !== undefined) {
                requestInit.body =
                    typeof options.body === 'string'
                        ? options.body
                        : new Uint8Array(options.body);
            }
            const response = await fetch(url, requestInit);
            return {
                status: response.status,
                headers: response.headers,
                body: await response.text(),
            };
        }
        catch (error) {
            if (timedOut) {
                throw new TimeoutError('HTTP request timed out', { cause: error });
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
//# sourceMappingURL=HttpTransport.js.map