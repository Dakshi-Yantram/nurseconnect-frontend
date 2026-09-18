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

  constructor(opts: {
    status: number;
    raw: string;
    code?: string | null;
    userMessage?: string | null;
    detail?: unknown;
    retryAfterSeconds?: number | null;
  }) {
    super(opts.raw);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.userMessage = opts.userMessage ?? null;
    this.detail = opts.detail;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
  }
}

/** Pull a readable message + code out of any FastAPI error body shape. */
export function parseErrorBody(raw: string): {
  message: string | null;
  code: string | null;
  detail: unknown;
  retryAfterSeconds: number | null;
} {
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    return { message: null, code: null, detail: undefined, retryAfterSeconds: null };
  }
  const detail = j?.detail ?? j;
  let message: string | null = null;
  let code: string | null = null;
  let retryAfterSeconds: number | null = null;
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
  }
  return { message, code, detail, retryAfterSeconds };
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
  return new ApiError({
    status: res.status,
    raw: raw || `Request failed (${res.status})`,
    code: parsed.code,
    userMessage: parsed.message,
    detail: parsed.detail,
    retryAfterSeconds: parsed.retryAfterSeconds,
  });
}

export async function apiFetch(path: string, init?: ApiInit) {
  const token = localStorage.getItem("access_token");
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return null;
  return res.json();
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
    if (e.userMessage) return e.userMessage;
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
      default:
        return e.status >= 500 ? "Something went wrong on our side. Please try again in a moment." : fallback;
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

function formatWait(s: number): string {
  if (s < 60) return `${s} seconds`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}
