export async function fetchSafely(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(fallbackMessage);
  }
}

export async function readJsonSafely(
  response: Response,
  fallbackMessage: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
}
