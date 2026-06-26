const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export class ApiClientError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string; details?: unknown } } | null;
  if (!response.ok) {
    throw new ApiClientError(payload?.error?.message ?? "Request failed", response.status, payload?.error?.details);
  }
  return payload?.data as T;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const nonRefreshable = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];
  if (response.status === 401 && retry && !nonRefreshable.includes(path)) {
    const refresh = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refresh.ok) return api<T>(path, init, false);
  }
  return parseResponse<T>(response);
}
