import { isAllowedFritzBoxUrl } from './is-fritzbox-url.validator';

describe('isAllowedFritzBoxUrl', () => {
  it('should allow HTTPS and HTTP to local addresses', () => {
    expect(isAllowedFritzBoxUrl('https://example.myfritz.net:443')).toBe(true);
    expect(isAllowedFritzBoxUrl('http://192.168.178.1')).toBe(true);
    expect(isAllowedFritzBoxUrl('http://fritz.box')).toBe(true);
  });

  it('should reject plain HTTP to public hosts', () => {
    expect(isAllowedFritzBoxUrl('http://example.myfritz.net')).toBe(false);
    expect(isAllowedFritzBoxUrl('http://93.184.216.34')).toBe(false);
  });

  it('should reject invalid values and other protocols', () => {
    expect(isAllowedFritzBoxUrl('192.168.178.1')).toBe(false);
    expect(isAllowedFritzBoxUrl('ftp://192.168.178.1')).toBe(false);
    expect(isAllowedFritzBoxUrl(undefined)).toBe(false);
  });
});
