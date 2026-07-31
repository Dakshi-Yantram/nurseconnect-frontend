const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || "Request failed";
    try {
      const body = JSON.parse(text);
      message = body?.detail || body?.message || message;
    } catch {
      // Keep the plain response body when the server did not return JSON.
    }
    throw new Error(message);
  }
  return res.json();
}
