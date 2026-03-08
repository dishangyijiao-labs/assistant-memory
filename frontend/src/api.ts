export interface ApiError extends Error {
  code?: string;
}

export async function api<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, options);
  const text = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = parseError(payload);
    const err: ApiError = new Error(msg);
    if (
      payload.error &&
      typeof payload.error === "object" &&
      "code" in (payload.error as Record<string, unknown>)
    ) {
      err.code = String((payload.error as Record<string, string>).code);
    }
    throw err;
  }
  return payload as T;
}

function parseError(payload: Record<string, unknown>): string {
  if (!payload) return "Request failed";
  if (typeof payload.error === "string") return payload.error;
  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in (payload.error as Record<string, unknown>)
  ) {
    return String((payload.error as Record<string, string>).message);
  }
  return "Request failed";
}
