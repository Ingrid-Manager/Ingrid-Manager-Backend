import { ConfigurationError } from '../errors/FritzBoxError.js';
export function validateFritzBoxConfig(config) {
    if (!config.id.trim() || !config.title.trim() || !config.ahaUser.trim()) {
        throw new ConfigurationError('FRITZ!Box id, title and username must not be empty');
    }
    if (!config.ahaPassword) {
        throw new ConfigurationError('FRITZ!Box password must not be empty');
    }
    try {
        const url = new URL(config.ahaUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            throw new ConfigurationError('ahaUrl must use HTTP or HTTPS');
        }
    }
    catch (error) {
        if (error instanceof ConfigurationError)
            throw error;
        throw new ConfigurationError('ahaUrl must be a valid HTTP or HTTPS URL', { cause: error });
    }
}
//# sourceMappingURL=FritzBoxConfig.js.map