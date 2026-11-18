import { prisma } from "./db";

export const BROWSER_UA = "Mozilla/5.0";

export class FetchError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

/** fetch with timeout + exponential retries (no retry on 4xx except 429). */
export async function fetchWithRetry(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<Response> {
  const { timeoutMs = 12000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ctrl.signal, headers: { "User-Agent": BROWSER_UA, ...(rest.headers || {}) } });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) throw new FetchError(`HTTP ${res.status} ${url}`, res.status);
      lastErr = new FetchError(`HTTP ${res.status} ${url}`, res.status);
    } catch (e) {
      if (e instanceof FetchError && e.status && e.status !== 429 && e.status < 500) throw e;
      lastErr = e;
    } finally {
      clearTimeout(t);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * 2 ** attempt + Math.random() * 300));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Records a provider's success/failure (/status page). Never throws. */
export async function recordProvider(id: string, ok: boolean, error?: unknown) {
  try {
    const now = new Date();
    const msg = error ? String(error instanceof Error ? error.message : error).slice(0, 500) : null;
    await prisma.providerStatus.upsert({
      where: { id },
      create: ok ? { id, lastSuccess: now, okCount: 1 } : { id, lastError: now, errorMsg: msg, errorCount: 1 },
      update: ok
        ? { lastSuccess: now, okCount: { increment: 1 } }
        : { lastError: now, errorMsg: msg, errorCount: { increment: 1 } },
    });
  } catch {
    /* telemetry must not break ingestion */
  }
}

export async function tracked<T>(id: string, fn: () => Promise<T>): Promise<T> {
  try {
    const r = await fn();
    await recordProvider(id, true);
    return r;
  } catch (e) {
    await recordProvider(id, false, e);
    throw e;
  }
}
