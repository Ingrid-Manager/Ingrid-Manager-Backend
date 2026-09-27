import { ConnectionError, TimeoutError } from '../errors/FritzBoxError.js';
export class RetryPolicy {
    maxAttempts;
    baseDelayMs;
    constructor(options = {}) {
        this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
        this.baseDelayMs = Math.max(0, options.baseDelayMs ?? 200);
    }
    async get(transport, url, options) {
        return this.execute(() => transport.get(url, options));
    }
    async post(transport, url, options) {
        return this.execute(() => transport.post(url, options));
    }
    async execute(request) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                const response = await request();
                if (!this.retryableStatus(response.status) || attempt === this.maxAttempts) {
                    return response;
                }
            }
            catch (error) {
                lastError = error;
                if (isAbortError(error) && !(error instanceof TimeoutError)) {
                    throw error;
                }
                if (attempt === this.maxAttempts) {
                    throw this.mapNetworkError(error);
                }
            }
            await this.delay(this.baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() * 0.5));
        }
        throw this.mapNetworkError(lastError);
    }
    retryableStatus(status) {
        return status === 502 || status === 503 || status === 504;
    }
    mapNetworkError(error) {
        if (error instanceof TimeoutError)
            return error;
        return new ConnectionError('FRITZ!Box network request failed', { cause: error });
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
function isAbortError(error) {
    return error instanceof DOMException && error.name === 'AbortError';
}
//# sourceMappingURL=RetryPolicy.js.map