import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).+$/;

/*
 * Einheitliche Passwortregel für Registrierung, Passwort-Reset,
 * Profiländerung und die Anlage bzw. Änderung durch die Verwaltung.
 */
export function IsAppPassword() {
  return applyDecorators(
    MinLength(PASSWORD_MIN_LENGTH),
    Matches(PASSWORD_PATTERN, {
      message:
        'Das Passwort muss Groß und Kleinbuchstaben, sowie mindestens eine Zahl oder ein Sonderzeichen beinhalten!',
    }),
  );
}
