export function validateAhaResponse(response: string): void {
  if (response === 'inval' || response === 'error') {
    throw new Error('AVM returned invalid response');
  }
}
