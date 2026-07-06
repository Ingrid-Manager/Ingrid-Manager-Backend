export function isPbkdf2Challenge(challenge: string): boolean {
  return challenge.startsWith('2$');
}
