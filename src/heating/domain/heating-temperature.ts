/*
 * Zulässiger Sollwertbereich eines FRITZ!DECT-Thermostats. Die Werte
 * entsprechen den Vorgaben der AHA-Schnittstelle (8 °C bis 28 °C in
 * 0,5-°C-Schritten) und werden bereits im Backend geprüft, damit ein
 * ungültiger Raumwert gar nicht erst an eine FRITZ!Box gesendet wird.
 */
export const MIN_TARGET_TEMPERATURE = 8;
export const MAX_TARGET_TEMPERATURE = 28;

export function isValidTargetTemperature(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_TARGET_TEMPERATURE &&
    value <= MAX_TARGET_TEMPERATURE &&
    Number.isInteger(value * 2)
  );
}
