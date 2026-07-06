export async function retry<T>(
  callback: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
