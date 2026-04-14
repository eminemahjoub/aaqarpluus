type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function checkRateLimit(key: string, maxRequests: number, windowSeconds: number) {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now > e.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (e.count >= maxRequests) return false;
  e.count += 1;
  return true;
}

