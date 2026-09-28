import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  AuthenticationError,
  ConnectionError,
  DeviceNotFoundError,
  FritzBox,
  InvalidTemperatureError,
} from '../libs/fritzbox-aha/index.js';

import { ParseAinPipe } from './ain.pipe';
import { toDiagnosticHttpError } from './diagnostic-http-error';
import { isHalfDegreeStep } from './dto/is-half-degree-step.validator';
import { FritzBoxConnectionManager } from './fritzbox-connection-manager.service';
import { HeatingService } from './heating.service';

describe('heating diagnostics', () => {
  describe('toDiagnosticHttpError', () => {
    it('should map FRITZ!Box library errors to HTTP errors', () => {
      expect(
        toDiagnosticHttpError(new AuthenticationError('bad credentials')),
      ).toBeInstanceOf(UnprocessableEntityException);
      expect(
        toDiagnosticHttpError(new ConnectionError('unreachable')),
      ).toBeInstanceOf(BadGatewayException);
      expect(
        toDiagnosticHttpError(new DeviceNotFoundError('unknown')),
      ).toBeInstanceOf(NotFoundException);
      expect(
        toDiagnosticHttpError(new InvalidTemperatureError('17.3')),
      ).toBeInstanceOf(BadRequestException);
    });

    it('should keep other errors unchanged', () => {
      const error = new Error('something else');

      expect(toDiagnosticHttpError(error)).toBe(error);
    });
  });

  describe('ParseAinPipe', () => {
    const pipe = new ParseAinPipe();

    it('should accept device and group AINs', () => {
      expect(pipe.transform(' 09995 0179707 ')).toBe('09995 0179707');
      expect(pipe.transform('11657 0240192-1')).toBe('11657 0240192-1');
      expect(pipe.transform('grp303E4F-3F7D9BE07')).toBe('grp303E4F-3F7D9BE07');
    });

    it('should reject invalid AINs', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
      expect(() => pipe.transform('../../etc')).toThrow(BadRequestException);
      expect(() => pipe.transform('a'.repeat(41))).toThrow(BadRequestException);
    });
  });

  describe('isHalfDegreeStep', () => {
    it('should only accept 0.5 °C steps', () => {
      expect(isHalfDegreeStep(21)).toBe(true);
      expect(isHalfDegreeStep(21.5)).toBe(true);
      expect(isHalfDegreeStep(21.3)).toBe(false);
      expect(isHalfDegreeStep('21')).toBe(false);
    });
  });

  describe('HeatingService diagnostic connection', () => {
    const dto = {
      id: 'diag',
      title: 'Diagnose',
      ahaUrl: 'http://192.168.178.1',
      ahaUser: 'admin',
      ahaPassword: 'secret',
    };

    let service: HeatingService;
    let connect: jest.SpyInstance;
    let disconnect: jest.SpyInstance;

    beforeEach(() => {
      service = new HeatingService({} as FritzBoxConnectionManager);
      connect = jest
        .spyOn(FritzBox.prototype, 'connect')
        .mockResolvedValue(undefined);
      disconnect = jest
        .spyOn(FritzBox.prototype, 'disconnect')
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      connect.mockRestore();
      disconnect.mockRestore();
    });

    it('should close the previous session when connecting again', async () => {
      await service.connect(dto);
      expect(disconnect).not.toHaveBeenCalled();

      await service.connect(dto);
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('should report a failed login as 422 and keep the previous session', async () => {
      await service.connect(dto);
      connect.mockRejectedValueOnce(new AuthenticationError('bad'));

      await expect(service.connect(dto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(disconnect).not.toHaveBeenCalled();
      expect(service.testConnection().id).toBe('diag');
    });

    it('should require a connection before checking groups', async () => {
      await expect(service.isGroup('grp1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
