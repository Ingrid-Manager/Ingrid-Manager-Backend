import bcrypt from 'bcryptjs';

/*
 * Kostenfaktor für bcrypt. Gilt nur für neu gesetzte Passwörter; bestehende
 * Hashes tragen ihren Kostenfaktor selbst und bleiben gültig.
 */
export const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);

  return bcrypt.hash(password, salt);
}
