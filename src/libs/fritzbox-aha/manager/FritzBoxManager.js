import { EventEmitter } from 'node:events';
import { ConfigurationError, FritzBoxError } from '../errors/FritzBoxError.js';
import { FritzBox } from '../fritzbox/FritzBox.js';
/** Coordinates multiple isolated FRITZ!Box instances. */
export class FritzBoxManager extends EventEmitter {
    boxes = new Map();
    /** Adds a uniquely identified FRITZ!Box. @throws ConfigurationError if the id is already registered or configuration is invalid. */
    add(config) {
        if (this.boxes.has(config.id)) {
            throw new ConfigurationError(`FRITZ!Box id already exists: ${config.id}`);
        }
        const box = new FritzBox(config);
        box.on('connected', (event) => this.emit('connected', event));
        box.on('disconnected', (event) => this.emit('disconnected', event));
        this.boxes.set(config.id, box);
        return box;
    }
    /** Removes a FRITZ!Box after disconnecting it. */
    async remove(id) {
        const box = this.boxes.get(id);
        if (!box)
            return;
        await box.disconnect();
        this.boxes.delete(id);
    }
    /** Returns a registered FRITZ!Box, if present. */
    get(id) {
        return this.boxes.get(id);
    }
    list() {
        return [...this.boxes.values()];
    }
    /** Connects all boxes independently and returns one result per box. */
    async connectAll() {
        return Promise.all(this.list().map(async (box) => {
            try {
                await box.connect();
                return { id: box.config.id, ok: true };
            }
            catch (error) {
                return {
                    id: box.config.id,
                    ok: false,
                    error: error instanceof FritzBoxError
                        ? error
                        : new ConfigurationError('Unknown connection error'),
                };
            }
        }));
    }
    /** Disconnects all boxes independently and returns one result per box. */
    async disconnectAll() {
        return Promise.all(this.list().map(async (box) => {
            try {
                await box.disconnect();
                return { id: box.config.id, ok: true };
            }
            catch (error) {
                return {
                    id: box.config.id,
                    ok: false,
                    error: error instanceof FritzBoxError
                        ? error
                        : new ConfigurationError('Unknown disconnect error'),
                };
            }
        }));
    }
    async listDevices() {
        const groups = await Promise.all(this.list().map(async (box) => (await box.devices.list()).map((device) => ({
            ...device,
            fritzBoxId: box.config.id,
        }))));
        return groups.flat();
    }
}
//# sourceMappingURL=FritzBoxManager.js.map