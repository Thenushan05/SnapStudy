export const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_API_BASE_URL ?? "http://localhost:5000";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions<TBody = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: TBody;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: HttpOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function withTimeout<T>(
  p: Promise<T>,
  ms?: number,
  signal?: AbortSignal
): Promise<T> {
  if (!ms) return p;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Request timed out after ${ms} ms`)),
      ms
    );
  });
  try {
    const res = await Promise.race([p, timeoutPromise]);
    return res as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public url: string,
    public body?: unknown
  ) {
    super(`HTTP ${status} ${statusText}`);
  }
}

export async function request<TResponse = unknown, TBody = unknown>(
  path: string,
  opts: HttpOptions<TBody> = {}
): Promise<TResponse> {
  const { method = "GET", headers, query, body, signal, timeoutMs } = opts;
  const url = buildUrl(path, query);

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    signal,
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData || typeof body === "string") {
      init.body = body as unknown as BodyInit;
      if (body instanceof FormData) {
        delete (init.headers as Record<string, string>)["Content-Type"];
      }
    } else if (body instanceof Blob) {
      init.body = body as unknown as BodyInit;
    } else {
      init.body = JSON.stringify(body);
    }
  }

  const fetchPromise = fetch(url, init).then(async (res) => {
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson
      ? await res.json().catch(() => undefined)
      : await res.text().catch(() => undefined);
    if (!res.ok) throw new HttpError(res.status, res.statusText, url, data);
    return data as TResponse;
  });

  return withTimeout(fetchPromise, timeoutMs, signal);
}

export function get<TResponse = unknown>(
  path: string,
  opts?: Omit<HttpOptions, "method" | "body">
) {
  return request<TResponse>(path, { ...(opts || {}), method: "GET" });
}
export function post<TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  opts?: Omit<HttpOptions<TBody>, "method" | "body">
) {
  return request<TResponse, TBody>(path, {
    ...(opts || {}),
    method: "POST",
    body,
  });
}
export function put<TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  opts?: Omit<HttpOptions<TBody>, "method" | "body">
) {
  return request<TResponse, TBody>(path, {
    ...(opts || {}),
    method: "PUT",
    body,
  });
}
export function patch<TResponse = unknown, TBody = unknown>(
  path: string,
  body?: TBody,
  opts?: Omit<HttpOptions<TBody>, "method" | "body">
) {
  return request<TResponse, TBody>(path, {
    ...(opts || {}),
    method: "PATCH",
    body,
  });
}
export function del<TResponse = unknown>(
  path: string,
  opts?: Omit<HttpOptions, "method" | "body">
) {
  return request<TResponse>(path, { ...(opts || {}), method: "DELETE" });
}

export const http = { request, get, post, put, patch, delete: del } as const;
