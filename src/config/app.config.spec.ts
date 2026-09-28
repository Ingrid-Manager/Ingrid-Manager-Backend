import { isSwaggerEnabled } from './app.config';

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
