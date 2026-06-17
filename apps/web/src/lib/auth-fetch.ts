"use client";

let refreshPromise: Promise<boolean> | null = null;

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  for (const c of document.cookie.split("; ")) {
    const [name, ...rest] = c.split("=");
    if (name === "csrf_token" || name === "__Host-csrf_token") {
      return rest.join("=");
    }
  }
  return null;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(init.headers);
  if (isMutation) {
    const token = getCsrfToken();
    if (token) {
      headers.set("x-csrf-token", token);
    }
  }

  let first: Response;
  try {
    first = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error("تعذر الاتصال بالخادم");
  }

  if (first.status !== 401) return first;

  const ok = await tryRefresh();
  if (!ok) return first;

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

