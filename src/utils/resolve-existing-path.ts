import { existsSync } from 'node:fs';

/*
 * Liefert den ersten existierenden Pfad aus `candidates`. Existiert keiner,
 * wird der letzte Kandidat zurückgegeben, damit die anschließende
 * Fehlermeldung beim Lesen den erwarteten Pfad nennt.
 */
export function resolveExistingPath(candidates: string[]): string {
  return (
    candidates.find((candidate) => existsSync(candidate)) ??
    candidates[candidates.length - 1]
  );
}
