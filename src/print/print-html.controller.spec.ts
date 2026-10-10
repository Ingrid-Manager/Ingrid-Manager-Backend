import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AllConfigType } from '../config/config.type';
import { PrintHtmlCacheService } from './print-html-cache.service';
import { PrintHtmlController } from './print-html.controller';

describe('PrintHtmlController', () => {
  const response = () =>
    ({ set: jest.fn(), send: jest.fn() }) as unknown as Response;

  const controllerWith = (
    values: Record<string, string | undefined>,
    html: string | null = '<html></html>',
  ) => {
    const cache = { consume: jest.fn(() => html) };
    const controller = new PrintHtmlController(
      cache as unknown as PrintHtmlCacheService,
      {
        get: jest.fn((key: string) => values[key]),
      } as unknown as ConfigService<AllConfigType>,
    );

    return { controller, cache };
  };

  it('should reject requests when no key is configured', () => {
    const { controller, cache } = controllerWith({});

    expect(() => controller.get('token', 'anything', response())).toThrow(
      UnauthorizedException,
    );
    expect(cache.consume).not.toHaveBeenCalled();
  });

  it('should accept the app key when no callback key is configured', () => {
    const { controller } = controllerWith({ 'app.pdfServiceAppKey': 'app' });
    const res = response();

    controller.get('token', 'app', res);

    expect(res.send).toHaveBeenCalledWith('<html></html>');
  });

  it('should require the callback key when it is configured', () => {
    const { controller, cache } = controllerWith({
      'app.pdfServiceAppKey': 'app',
      'app.pdfServiceCallbackKey': 'callback',
    });

    expect(() => controller.get('token', 'app', response())).toThrow(
      UnauthorizedException,
    );
    expect(cache.consume).not.toHaveBeenCalled();

    const res = response();
    controller.get('token', 'callback', res);
    expect(res.send).toHaveBeenCalled();
  });

  it('should answer with 404 for unknown or used tokens', () => {
    const { controller } = controllerWith(
      { 'app.pdfServiceAppKey': 'app' },
      null,
    );

    expect(() => controller.get('token', 'app', response())).toThrow(
      NotFoundException,
    );
  });
});
