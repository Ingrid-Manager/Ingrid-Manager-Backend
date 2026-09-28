import { isLocalOrPrivateHost, isSecureOrLocalUrl } from './local-host';

describe('local-host', () => {
  it('should detect local and private hosts', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.178.1',
      '169.254.1.1',
      '[::1]',
      'fd00::1',
      'fritz.box',
      'pdf-service',
    ]) {
      expect(isLocalOrPrivateHost(host)).toBe(true);
    }
  });

  it('should treat public hosts as not local', () => {
    for (const host of [
      '8.8.8.8',
      '172.32.0.1',
      '192.169.0.1',
      'pdf.ingrid-manager.de',
      'example.myfritz.net',
      '2001:db8::1',
    ]) {
      expect(isLocalOrPrivateHost(host)).toBe(false);
    }
  });

  it('should only allow plain HTTP for local or private hosts', () => {
    expect(isSecureOrLocalUrl(new URL('https://pdf.example.org'))).toBe(true);
    expect(isSecureOrLocalUrl(new URL('http://192.168.178.1'))).toBe(true);
    expect(isSecureOrLocalUrl(new URL('http://pdf.example.org'))).toBe(false);
    expect(isSecureOrLocalUrl(new URL('ftp://192.168.178.1'))).toBe(false);
  });
});
