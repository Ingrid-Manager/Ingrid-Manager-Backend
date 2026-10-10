import * as crypto from 'crypto';

import { CryptoService } from './crypto.service';

const KEY = 'k'.repeat(32);
const PREVIOUS_KEY = 'p'.repeat(32);

function legacyCbcEncrypt(value: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'utf8'),
    iv,
  );
  return `${iv.toString('hex')}:${cipher.update(value, 'utf8', 'hex')}${cipher.final('hex')}`;
}

describe('CryptoService', () => {
  const originalKey = process.env.APP_CRYPTO_KEY;
  const originalPreviousKey = process.env.APP_CRYPTO_PREVIOUS_KEY;

  const createService = (key = KEY, previousKey?: string) => {
    process.env.APP_CRYPTO_KEY = key;
    if (previousKey) {
      process.env.APP_CRYPTO_PREVIOUS_KEY = previousKey;
    } else {
      delete process.env.APP_CRYPTO_PREVIOUS_KEY;
    }
    return new CryptoService();
  };

  afterEach(() => {
    process.env.APP_CRYPTO_KEY = originalKey;
    if (originalPreviousKey === undefined) {
      delete process.env.APP_CRYPTO_PREVIOUS_KEY;
    } else {
      process.env.APP_CRYPTO_PREVIOUS_KEY = originalPreviousKey;
    }
  });

  it('should encrypt with a versioned, authenticated format and decrypt again', () => {
    const service = createService();

    const encrypted = service.encrypt('geheim123');

    expect(encrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(service.encrypt('geheim123')).not.toBe(encrypted);
    expect(service.decryptWithMetadata(encrypted)).toEqual({
      value: 'geheim123',
      needsReEncryption: false,
    });
  });

  it('should detect manipulated ciphertexts', () => {
    const service = createService();
    const parts = service.encrypt('geheim123').split(':');
    const flipped = (parseInt(parts[3][0], 16) ^ 1).toString(16);
    parts[3] = flipped + parts[3].slice(1);

    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });

  it('should still read legacy AES-256-CBC values and flag them for re-encryption', () => {
    const service = createService();

    expect(
      service.decryptWithMetadata(legacyCbcEncrypt('altes-passwort', KEY)),
    ).toEqual({ value: 'altes-passwort', needsReEncryption: true });
  });

  it('should decrypt values of the previous key during a key rotation', () => {
    const encryptedWithPreviousKey =
      createService(PREVIOUS_KEY).encrypt('rotieren');
    const service = createService(KEY, PREVIOUS_KEY);

    expect(service.decryptWithMetadata(encryptedWithPreviousKey)).toEqual({
      value: 'rotieren',
      needsReEncryption: true,
    });
  });

  it('should fail for values of an unknown key', () => {
    const encrypted = createService(PREVIOUS_KEY).encrypt('fremd');

    expect(() => createService(KEY).decrypt(encrypted)).toThrow();
  });

  it('should reject malformed values', () => {
    const service = createService();

    expect(() => service.decrypt('v1:abc')).toThrow('Invalid encrypted value');
    expect(() => service.decrypt('kein-chiffrat')).toThrow(
      'Invalid encrypted value',
    );
  });
});
