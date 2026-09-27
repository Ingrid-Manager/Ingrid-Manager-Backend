import { EventEmitter } from 'node:events';
import { validateFritzBoxConfig } from './FritzBoxConfig.js';
import { FetchHttpTransport, } from '../transport/HttpTransport.js';
import { RetryPolicy } from '../transport/RetryPolicy.js';
import { Pbkdf2Authenticator } from '../authentication/Pbkdf2Authenticator.js';
import { DefaultSessionManager, } from '../session/SessionManager.js';
import { AhaClient } from '../aha/AhaClient.js';
import { AhaResponseParser } from '../aha/AhaResponseParser.js';
import { DefaultDeviceService, } from '../devices/DeviceService.js';
import { ThermostatService } from '../thermostats/ThermostatService.js';
import { ConnectionError } from '../errors/FritzBoxError.js';
import { DefaultGroupService, } from '../groups/GroupService.js';
export class FritzBox extends EventEmitter {
    config;
    devices;
    thermostats;
    state = 'disconnected';
    session;
    groups;
    constructor(config, transport) {
        super();
        this.config = config;
        validateFritzBoxConfig(config);
        const http = transport ?? new FetchHttpTransport();
        const retry = new RetryPolicy();
        const authenticator = new Pbkdf2Authenticator(config.ahaUrl, config.ahaUser, config.ahaPassword, http, retry);
        this.session = new DefaultSessionManager(authenticator, config.ahaUrl, http, retry);
        const aha = new AhaClient(config.ahaUrl, this.session, http, retry);
        const parser = new AhaResponseParser();
        this.devices = new DefaultDeviceService(aha, parser);
        this.thermostats = new ThermostatService(aha, parser, this.devices);
        this.groups = new DefaultGroupService(aha, parser, this.devices);
    }
    async connect() {
        this.state = 'connecting';
        try {
            await this.session.getSid();
            this.state = 'connected';
            this.emit('connected', { fritzBoxId: this.config.id });
        }
        catch (error) {
            this.state = 'disconnected';
            throw error instanceof Error
                ? error
                : new ConnectionError('Connection failed');
        }
    }
    async disconnect() {
        try {
            await this.session.logout();
        }
        finally {
            this.state = 'disconnected';
        }
        this.emit('disconnected', { fritzBoxId: this.config.id });
    }
    isConnected() {
        return this.state === 'connected';
    }
    getState() {
        return this.state;
    }
    async listDevices() {
        return this.devices.list();
    }
    async listGroups() {
        return this.groups.list();
    }
    async isGroup(ain) {
        return this.groups.isGroup(ain);
    }
    async getGroupTemperature(ain) {
        return this.groups.getTemperature(ain);
    }
}
//# sourceMappingURL=FritzBox.js.map