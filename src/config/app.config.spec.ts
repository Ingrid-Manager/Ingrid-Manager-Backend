import { isSwaggerEnabled, parseCorsOrigins } from './app.config';

describe('parseCorsOrigins', () => {
  it('should default to the origin of FRONTEND_DOMAIN', () => {
    expect(
      parseCorsOrigins(undefined, 'https://ingrid-manager.de/app/'),
    ).toEqual(['https://ingrid-manager.de']);
  });

  it('should prefer APP_CORS_ORIGINS over FRONTEND_DOMAIN', () => {
    expect(
      parseCorsOrigins(
        ' https://a.example.org , http://localhost:5173/ ',
        'https://ingrid-manager.de',
      ),
    ).toEqual(['https://a.example.org', 'http://localhost:5173']);
  });

  it('should allow http and https for values without a scheme', () => {
    expect(parseCorsOrigins(undefined, 'ingrid-manager.de')).toEqual([
      'https://ingrid-manager.de',
      'http://ingrid-manager.de',
    ]);
  });

  it('should allow no origin when nothing is configured', () => {
    expect(parseCorsOrigins('', undefined)).toEqual([]);
  });

  it('should reject invalid origins', () => {
    expect(() => parseCorsOrigins('https://', undefined)).toThrow(
      'Ungültige Origin',
    );
  });
});

describe('isSwaggerEnabled', () => {
  it('should be disabled when NODE_ENV is missing', () => {
    expect(isSwaggerEnabled({})).toBe(false);
  });

  it('should be enabled in development by default', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('should be disabled in production by default', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('should follow APP_SWAGGER_ENABLED when set', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'production', APP_SWAGGER_ENABLED: 'true' }),
    ).toBe(true);
    expect(
      isSwaggerEnabled({
        NODE_ENV: 'development',
        APP_SWAGGER_ENABLED: 'false',
      }),
    ).toBe(false);
  });
});
