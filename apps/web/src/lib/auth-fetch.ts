"use client";

let refreshPromise: Promise<boolean> | null = null;

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
  const first = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (first.status !== 401) return first;

  const ok = await tryRefresh();
  if (!ok) return first;

  return fetch(input, {
    ...init,
    credentials: "include",
  });
}

