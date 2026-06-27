const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000/api/v1";

let accessToken: string | null = null;

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

function extractAccessToken(value: unknown): string | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const token = (value as Record<string, unknown>).accessToken;

  return typeof token === "string" && token.length > 0
    ? token
    : null;
}

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new ApiClientError(
      payload?.error?.message ?? "Request failed",
      response.status,
      payload?.error?.details,
    );
  }

  return payload?.data as T;
}

function createHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);

  const isFormData =
    typeof FormData !== "undefined" &&
    init.body instanceof FormData;

  if (init.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set(
      "Authorization",
      `Bearer ${accessToken}`,
    );
  }

  return headers;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_URL}/auth/refresh`,
      {
        method: "POST",
        credentials: "include",
      },
    );

    if (!response.ok) {
      clearAccessToken();
      return false;
    }

    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;

    const nextAccessToken =
      extractAccessToken(payload?.data);

    if (!nextAccessToken) {
      clearAccessToken();
      return false;
    }

    setAccessToken(nextAccessToken);

    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: createHeaders(init),
  });

  const nonRefreshableRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
  ];

  const canRefresh =
    response.status === 401 &&
    retry &&
    !nonRefreshableRoutes.includes(path);

  if (canRefresh) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return api<T>(path, init, false);
    }
  }

  const data = await parseResponse<T>(response);

  /*
   * Login aur register response se access token
   * automatically memory me save hoga.
   */
  if (
    path === "/auth/login" ||
    path === "/auth/register"
  ) {
    const token = extractAccessToken(data);

    if (token) {
      setAccessToken(token);
    }
  }

  if (path === "/auth/logout") {
    clearAccessToken();
  }

  return data;
}