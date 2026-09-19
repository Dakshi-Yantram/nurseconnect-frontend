export const BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Error thrown by apiFetch for any non-2xx response, network failure or timeout.
 *
 * BACKWARD COMPATIBLE: `.message` is still the raw response text, exactly as
 * before, because several screens do `JSON.parse(e.message)`. New code should
 * use `apiErrorMessage(e)` / `.status` / `.code` instead of string-sniffing.
 */
export class ApiError extends Error {
  /** HTTP status; 0 = network error / CORS / timeout (no response). */
  readonly status: number;
  /** Backend `detail.code` when present (e.g. "OTP_SEND_FAILED"), else a synthetic one. */
  readonly code: string | null;
  /** Human-readable message extracted from the backend's `detail`. */
  readonly userMessage: string | null;
  /** Parsed `detail` (string | object | array) when the body was JSON. */
  readonly detail: unknown;
  readonly retryAfterSeconds: number | null;
  /** Server request id (detail.request_id or X-Request-Id) — quote to support. */
  readonly requestId: string | null;

  constructor(opts: {
    status: number;
    raw: string;
    code?: string | null;
    userMessage?: string | null;
    detail?: unknown;
    retryAfterSeconds?: number | null;
    requestId?: string | null;
  }) {
    super(opts.raw);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.userMessage = opts.userMessage ?? null;
    this.detail = opts.detail;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    this.requestId = opts.requestId ?? null;
  }
}

/** Pull a readable message + code out of any FastAPI error body shape. */
export function parseErrorBody(raw: string): {
  message: string | null;
  code: string | null;
  detail: unknown;
  retryAfterSeconds: number | null;
  requestId: string | null;
} {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return { message: null, code: null, detail: undefined, retryAfterSeconds: null, requestId: null };
  }
  const detail = j?.detail ?? j;
  let message: string | null = null;
  let code: string | null = null;
  let retryAfterSeconds: number | null = null;
  let requestId: string | null = null;
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    // FastAPI 422 validation errors: [{loc, msg, type}]
    message = detail
      .map((d: any) => (typeof d === "string" ? d : d?.msg))
      .filter(Boolean)
      .join(", ") || null;
    code = "VALIDATION_ERROR";
  } else if (detail && typeof detail === "object") {
    message = typeof detail.message === "string" ? detail.message : null;
    code = typeof detail.code === "string" ? detail.code : null;
    retryAfterSeconds =
      typeof detail.retry_after_seconds === "number" ? detail.retry_after_seconds : null;
    requestId = typeof detail.request_id === "string" ? detail.request_id : null;
  }
  return { message, code, detail, retryAfterSeconds, requestId };
}

export type ApiInit = RequestInit & {
  /** Abort after this many ms and throw an ApiError(code "TIMEOUT"). Opt-in. */
  timeoutMs?: number;
};

/** fetch() with an optional timeout that also honours a caller's AbortSignal. */
export async function fetchWithTimeout(url: string, init: ApiInit = {}): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init;
  if (!timeoutMs) {
    try {
      return await fetch(url, { ...rest, signal });
    } catch (e) {
      throw networkError(e);
    }
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } catch (e) {
    if (!signal?.aborted && ctrl.signal.aborted) {
      throw new ApiError({
        status: 0,
        raw: "Request timed out",
        code: "TIMEOUT",
        userMessage: "The server took too long to respond. Please check your connection and try again.",
      });
    }
    throw networkError(e);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function networkError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError({
    status: 0,
    raw: e instanceof Error ? e.message : String(e),
    code: "NETWORK_ERROR",
    userMessage: "Couldn't reach NurseConnect. Check your internet connection and try again.",
  });
}

export async function toApiError(res: Response): Promise<ApiError> {
  const raw = await res.text().catch(() => "");
  const parsed = parseErrorBody(raw);
  const headerRetry = Number(res.headers.get("retry-after"));
  return new ApiError({
    status: res.status,
    raw: raw || `Request failed (${res.status})`,
    code: parsed.code,
    userMessage: parsed.message,
    detail: parsed.detail,
    retryAfterSeconds: parsed.retryAfterSeconds ?? (Number.isFinite(headerRetry) && headerRetry > 0 ? headerRetry : null),
    requestId: parsed.requestId ?? res.headers.get("x-request-id"),
  });
}

// ---------------------------------------------------------------------------
// Session tokens
// ---------------------------------------------------------------------------
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
/** Fired on window when the session can't be refreshed; AuthProvider signs out. */
export const SESSION_EXPIRED_EVENT = "nc:session-expired";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function setTokens(access: string, refresh?: string | null) {
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh token for a new pair. Single-flight: concurrent 401s
 * share one refresh call (the backend rotates refresh tokens, so two parallel
 * refreshes would revoke each other).
 *
 * Previously the refresh token was stored but never used, so every user was
 * dropped to the login page when the access token expired — mid-visit too.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_KEY) : null;
  if (!refresh) return Promise.resolve(false);
  refreshInFlight = (async () => {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        timeoutMs: 15_000,
      });
      if (!res.ok) {
        // Only a definitive auth failure ends the session; a 5xx/network
        // blip should not log the user out.
        if (res.status === 401 || res.status === 403) {
          clearTokens();
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        }
        return false;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Revoke the server session (fire-and-forget) and clear local tokens. */
export async function revokeSession(): Promise<void> {
  const refresh = typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_KEY) : null;
  clearTokens();
  if (!refresh) return;
  try {
    await fetchWithTimeout(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      timeoutMs: 8_000,
      keepalive: true,
    });
  } catch {
    /* best effort — tokens are already gone locally */
  }
}

function isAuthPath(path: string) {
  return /^\/api\/auth\//.test(path);
}

function buildHeaders(init: ApiInit | undefined, token: string | null): HeadersInit {
  // FormData bodies must NOT get a JSON Content-Type: the browser has to set
  // multipart/form-data with the boundary itself.
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  return {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
}

export async function apiFetch(path: string, init?: ApiInit) {
  let res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, getAccessToken()),
  });
  // Transparent refresh-and-retry once on an expired/revoked access token.
  if (res.status === 401 && !isAuthPath(path) && (await refreshSession())) {
    res = await fetchWithTimeout(`${BASE_URL}${path}`, {
      ...init,
      headers: buildHeaders(init, getAccessToken()),
    });
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Multipart upload through the same auth / refresh / error pipeline. */
export function apiUpload(path: string, form: FormData, init?: ApiInit) {
  return apiFetch(path, { timeoutMs: 120_000, ...init, method: init?.method ?? "POST", body: form });
}

/**
 * The one place that turns any thrown value into text a user can act on.
 * Status-based defaults apply only when the backend didn't send a message.
 */
export function apiErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return e.userMessage ?? fallback;
    if (e.status === 401) {
      return "Your session has expired. Please sign in again to continue.";
    }
    if (e.userMessage) return withRef(e.userMessage, e);
    switch (e.status) {
      case 403:
        return "You don't have permission to view this.";
      case 404:
        return "We couldn't find what you were looking for.";
      case 409:
        return "This isn't available yet.";
      case 429:
        return e.retryAfterSeconds
          ? `Too many attempts. Please wait ${formatWait(e.retryAfterSeconds)} and try again.`
          : "Too many attempts. Please wait a few minutes and try again.";
      case 413:
        return "That file is too large. Please choose a smaller one.";
      case 415:
        return "That file type isn't supported.";
      case 422:
        return "Some of the details entered aren't valid. Please check and try again.";
      default:
        return e.status >= 500
          ? withRef("Something went wrong on our side. Please try again in a moment.", e)
          : fallback;
    }
  }
  if (e instanceof Error) {
    // Legacy throwers (raw text). Try to salvage a backend message.
    const parsed = parseErrorBody(e.message);
    if (parsed.message) return parsed.message;
    if (/failed to fetch|networkerror|load failed/i.test(e.message)) {
      return "Couldn't reach NurseConnect. Check your internet connection and try again.";
    }
  }
  return fallback;
}

export function isSessionExpired(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

/** Append a short support reference to server-side (5xx) errors. */
function withRef(message: string, e: ApiError): string {
  if (e.status < 500 || !e.requestId) return message;
  return `${message} (Ref: ${e.requestId.slice(0, 8)})`;
}

function formatWait(s: number): string {
  if (s < 60) return `${s} seconds`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}
