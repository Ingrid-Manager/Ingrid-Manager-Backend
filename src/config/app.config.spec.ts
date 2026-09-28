import { parseCorsOrigins } from './app.config';

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
