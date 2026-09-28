import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveExistingPath } from './resolve-existing-path';

describe('resolveExistingPath', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'resolve-existing-path-'));
  const existing = path.join(dir, 'template.hbs');
  writeFileSync(existing, 'x');

  it('should return the first existing candidate', () => {
    expect(resolveExistingPath([path.join(dir, 'missing.hbs'), existing])).toBe(
      existing,
    );
  });

  it('should fall back to the last candidate when none exists', () => {
    const last = path.join(dir, 'also-missing.hbs');

    expect(resolveExistingPath([path.join(dir, 'missing.hbs'), last])).toBe(
      last,
    );
  });
});
