export class AvmAuthException extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
  }
}
