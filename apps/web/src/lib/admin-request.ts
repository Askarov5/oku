export const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

export const SESSION_MESSAGE =
  "Your session expired. Reload the page to sign in again.";

export const readJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

/** A 401 means the admin cookie is gone. Every other status keeps the caller's wording. */
export const failureText = (status: number, fallback: string): string =>
  status === 401 ? SESSION_MESSAGE : fallback;

/** Error text from a JSON `{ error }` body. A 401 always means the session is gone. */
export const readError = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  if (response.status === 401) {
    return SESSION_MESSAGE;
  }
  const data = await readJson<{ error?: string }>(response);
  return data?.error ?? fallback;
};

export const isTimeout = (caught: unknown): boolean =>
  caught instanceof DOMException && caught.name === "TimeoutError";
