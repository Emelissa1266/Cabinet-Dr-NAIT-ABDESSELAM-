import { notifyAuthExpired, tokenStorage } from "./token-storage";

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

const defaultBaseUrl = "http://127.0.0.1:8000/api/v1";
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultBaseUrl).replace(/\/+$/, "");
let refreshPromise: Promise<string | null> | null = null;

function endpoint(path: string) {
  return `${apiBaseUrl}/${path.replace(/^\/+/, "")}`;
}

function isBodyInit(body: ApiBody): body is BodyInit {
  return typeof FormData !== "undefined" && body instanceof FormData
    || typeof Blob !== "undefined" && body instanceof Blob
    || typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams
    || typeof body === "string";
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

async function authorizedFetch(
  path: string,
  init: RequestInit,
  auth: boolean,
  retryOnUnauthorized: boolean,
) {
  const requestHeaders = new Headers(init.headers);
  const tokens = tokenStorage.read();
  if (auth && tokens?.access) requestHeaders.set("Authorization", `Bearer ${tokens.access}`);

  let response: Response;
  try {
    response = await fetch(endpoint(path), { ...init, headers: requestHeaders });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Connexion au serveur impossible.",
      0,
      null,
    );
  }

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const access = await refreshAccessToken();
    if (access) {
      requestHeaders.set("Authorization", `Bearer ${access}`);
      response = await fetch(endpoint(path), { ...init, headers: requestHeaders });
    }
  }

  return response;
}

async function refreshAccessToken() {
  const tokens = tokenStorage.read();
  if (!tokens?.refresh) return null;
  if (!refreshPromise) {
    refreshPromise = fetch(endpoint("auth/refresh/"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new ApiError(jsonMessage(data, "Session expirée."), response.status, data);
        if (typeof data !== "object" || data === null || !("access" in data) || typeof data.access !== "string") {
          throw new ApiError("Réponse de rafraîchissement invalide.", response.status, data);
        }
        const rotatedRefresh = "refresh" in data && typeof data.refresh === "string" ? data.refresh : undefined;
        tokenStorage.updateTokens(data.access, rotatedRefresh);
        return data.access;
      })
      .catch(() => {
        tokenStorage.clear();
        notifyAuthExpired();
        return null;
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
  if (!response.ok) throw new ApiError(jsonMessage(data, "La requête a échoué."), response.status, data);
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
    throw new ApiError(jsonMessage(data, "La requête a échoué."), response.status, data);
  }

  return { blob: await response.blob(), headers: response.headers, status: response.status };
}

export { apiBaseUrl };
