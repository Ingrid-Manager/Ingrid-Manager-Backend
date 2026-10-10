/*
 * Prüft, ob `value` einem Wert eines numerischen TypeScript-Enums
 * entspricht. Object.values() eines numerischen Enums enthält zusätzlich
 * die Namen (Reverse Mapping, z. B. "admin"), die hier bewusst nicht als
 * gültig gelten. Akzeptiert werden nur Zahlen und reine Ziffern-Strings.
 */
export function isNumericEnumValue(
  enumObject: Record<string, string | number>,
  value: unknown,
): boolean {
  const isNumeric =
    (typeof value === 'number' && Number.isInteger(value)) ||
    (typeof value === 'string' && /^\d+$/.test(value));

  if (!isNumeric) {
    return false;
  }

  return Object.values(enumObject)
    .filter((entry): entry is number => typeof entry === 'number')
    .includes(Number(value));
}
