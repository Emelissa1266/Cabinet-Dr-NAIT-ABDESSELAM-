import { notifyAuthExpired } from "./token-storage";

export type ApiBody = BodyInit | object | null;

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: ApiBody;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export interface ApiBlobResponse {
  blob: Blob;
  headers: Headers;
  status: number;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const defaultBaseUrl = "http://localhost:8000/api/v1";
const configuredApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultBaseUrl).replace(/\/+$/, "");
const csrfCookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "clinic_csrftoken";
let csrfPromise: Promise<string | null> | null = null;
let refreshPromise: Promise<boolean> | null = null;

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function apiBaseUrl() {
  if (typeof window === "undefined") return configuredApiBaseUrl;
  try {
    const url = new URL(configuredApiBaseUrl);
    if (isLoopbackHost(url.hostname) && isLoopbackHost(window.location.hostname)) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return configuredApiBaseUrl;
  }
}

function endpoint(path: string) {
  return `${apiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

function isBodyInit(body: ApiBody): body is BodyInit {
  return typeof FormData !== "undefined" && body instanceof FormData
    || typeof Blob !== "undefined" && body instanceof Blob
    || typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams
    || typeof body === "string";
}

function isSafeMethod(method?: string) {
  return !method || ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${encodeURIComponent(name)}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function canWriteApiCookie() {
  if (typeof window === "undefined") return false;
  try {
    return new URL(apiBaseUrl()).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function writeCsrfCookie(token: string) {
  if (typeof document === "undefined" || !canWriteApiCookie()) return;
  document.cookie = `${encodeURIComponent(csrfCookieName)}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
}

function jsonMessage(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null && "detail" in data && typeof data.detail === "string") {
    return data.detail;
  }
  if (typeof data === "object" && data !== null && "non_field_errors" in data && Array.isArray(data.non_field_errors)) {
    return data.non_field_errors.join(" ");
  }
  return fallback;
}

async function readResponse(response: Response) {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json() as Promise<unknown>;
  return response.text();
}

async function ensureCsrfToken() {
  const existing = readCookie(csrfCookieName);
  if (existing) return existing;
  if (!csrfPromise) {
    csrfPromise = fetch(endpoint("auth/csrf/"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new ApiError(jsonMessage(data, "Session de sécurité indisponible."), response.status, data);
        const cookieToken = readCookie(csrfCookieName);
        if (cookieToken) return cookieToken;
        if (typeof data === "object" && data !== null && "csrfToken" in data && typeof data.csrfToken === "string") {
          writeCsrfCookie(data.csrfToken);
          return data.csrfToken;
        }
        return null;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

async function attachCsrfHeader(headers: Headers, method?: string) {
  if (isSafeMethod(method) || headers.has("X-CSRFToken")) return;
  const csrfToken = await ensureCsrfToken();
  if (csrfToken) headers.set("X-CSRFToken", csrfToken);
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  auth: boolean,
  retryOnUnauthorized: boolean,
) {
  const requestHeaders = new Headers(init.headers);
  await attachCsrfHeader(requestHeaders, init.method);
  const requestInit = { ...init, credentials: "include" as RequestCredentials, headers: requestHeaders };

  let response: Response;
  try {
    response = await fetch(endpoint(path), requestInit);
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Connexion au serveur impossible.",
      0,
      null,
    );
  }

  if (response.status === 401 && auth && retryOnUnauthorized && isSafeMethod(init.method)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await fetch(endpoint(path), requestInit);
  }

  return response;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = ensureCsrfToken()
      .then((csrfToken) => fetch(endpoint("auth/refresh/"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
      }))
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new ApiError(jsonMessage(data, "Session expirée."), response.status, data);
        return true;
      })
      .catch(() => {
        notifyAuthExpired();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, retryOnUnauthorized = true, body, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", requestHeaders.get("Accept") ?? "application/json");

  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isBodyInit(body)) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  const response = await authorizedFetch(
    path,
    { ...init, headers: requestHeaders, body: requestBody },
    auth,
    retryOnUnauthorized,
  );

  const data = await readResponse(response);
  if (!response.ok) throw new ApiError(jsonMessage(data, "Impossible de traiter la demande."), response.status, data);
  return data as T;
}

export async function apiBlobRequest(path: string, options: ApiRequestOptions = {}): Promise<ApiBlobResponse> {
  const { auth = true, retryOnUnauthorized = true, body, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", requestHeaders.get("Accept") ?? "*/*");

  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isBodyInit(body)) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  const response = await authorizedFetch(
    path,
    { ...init, headers: requestHeaders, body: requestBody },
    auth,
    retryOnUnauthorized,
  );

  if (!response.ok) {
    const data = await readResponse(response);
    throw new ApiError(jsonMessage(data, "Impossible de traiter la demande."), response.status, data);
  }

  return { blob: await response.blob(), headers: response.headers, status: response.status };
}

export { apiBaseUrl };
