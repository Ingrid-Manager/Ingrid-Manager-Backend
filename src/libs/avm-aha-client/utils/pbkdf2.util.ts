import { pbkdf2Sync } from 'crypto';

export function createPbkdf2Response(
  challenge: string,
  password: string,
): string {
  const parts = challenge.split('$');
  const iter1 = Number(parts[1]);
  const salt1 = Buffer.from(parts[2], 'hex');
  const iter2 = Number(parts[3]);
  const salt2 = Buffer.from(parts[4], 'hex');
  const hash1 = pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    salt1,
    iter1,
    32,
    'sha256',
  );
  const hash2 = pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256');
  return `${parts[4]}$${hash2.toString('hex')}`;
}
