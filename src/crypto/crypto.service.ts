import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DecryptResult {
  value: string;
  /*
   * true, wenn der Wert noch im alten Format (AES-256-CBC ohne Präfix) oder
   * mit APP_CRYPTO_PREVIOUS_KEY verschlüsselt ist und daher mit dem
   * aktuellen Schlüssel neu verschlüsselt werden sollte.
   */
  needsReEncryption: boolean;
}

/*
 * Symmetrische Verschlüsselung für gespeicherte Zugangsdaten (z. B. das
 * FRITZ!Box-Passwort einer AVM-Location).
 *
 * Aktuelles Format: "v1:<iv>:<authTag>:<ciphertext>" (alles hex) mit
 * AES-256-GCM. Anders als das frühere AES-256-CBC ist GCM authentifiziert:
 * Manipulierte Chiffrate oder ein falscher Schlüssel führen zu einem
 * Fehler statt zu unbemerkt verändertem Klartext.
 *
 * Altbestand im Format "<iv>:<ciphertext>" (AES-256-CBC) bleibt lesbar.
 * Zur Schlüsselrotation kann der bisherige Schlüssel als
 * APP_CRYPTO_PREVIOUS_KEY gesetzt werden: v1-Werte, die sich damit (und
 * nicht mit APP_CRYPTO_KEY) entschlüsseln lassen, werden als
 * needsReEncryption gemeldet. CBC-Altbestand wird nur mit APP_CRYPTO_KEY
 * gelesen und sollte daher vor einer Rotation umgeschlüsselt werden.
 */
@Injectable()
export class CryptoService {
  private static readonly VERSION = 'v1';
  private static readonly GCM_IV_LENGTH = 12;
  private static readonly GCM_TAG_LENGTH = 16;
  private static readonly LEGACY_ALGORITHM = 'aes-256-cbc';

  private readonly secretKey = Buffer.from(process.env.APP_CRYPTO_KEY!, 'utf8');
  private readonly previousKey = process.env.APP_CRYPTO_PREVIOUS_KEY
    ? Buffer.from(process.env.APP_CRYPTO_PREVIOUS_KEY, 'utf8')
    : null;

  encrypt(value: string): string {
    const iv = crypto.randomBytes(CryptoService.GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv, {
      authTagLength: CryptoService.GCM_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    return [
      CryptoService.VERSION,
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(value: string): string {
    return this.decryptWithMetadata(value).value;
  }

  decryptWithMetadata(value: string): DecryptResult {
    const parts = value.split(':');

    if (parts[0] === CryptoService.VERSION) {
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted value');
      }

      try {
        return {
          value: this.decryptGcm(parts, this.secretKey),
          needsReEncryption: false,
        };
      } catch (error) {
        if (!this.previousKey) {
          throw error;
        }

        return {
          value: this.decryptGcm(parts, this.previousKey),
          needsReEncryption: true,
        };
      }
    }

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted value');
    }

    return { value: this.decryptLegacyCbc(parts), needsReEncryption: true };
  }

  private decryptGcm(parts: string[], key: Buffer): string {
    const [, ivHex, tagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
      { authTagLength: CryptoService.GCM_TAG_LENGTH },
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private decryptLegacyCbc(parts: string[]): string {
    const [ivHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(
      CryptoService.LEGACY_ALGORITHM,
      this.secretKey,
      Buffer.from(ivHex, 'hex'),
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }
}
