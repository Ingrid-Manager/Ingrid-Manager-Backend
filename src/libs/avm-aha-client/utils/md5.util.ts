import { createHash } from 'crypto';

export function createMd5Response(challenge: string, password: string): string {
  const hash = createHash('md5')
    .update(Buffer.from(`${challenge}-${password}`, 'utf16le'))
    .digest('hex');
  return `${challenge}-${hash}`;
}
