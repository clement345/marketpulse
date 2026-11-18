/** Common contract for all quote providers: replaceable without touching the rest. */
export interface QuoteData {
  symbol: string;
  price: number;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  currency: string | null;
  quoteTime: Date;
  exchangeTz: string | null;
  latency: "realtime" | "delayed" | "eod";
  provider: string;
  sparkline: [number, number][]; // [epochSec, value]
  name?: string;
}

export interface HistoryBar { time: number; open: number; high: number; low: number; close: number; volume?: number }

export interface QuoteProvider {
  id: string;
  getQuotes(symbols: { symbol: string; providerSymbol?: string }[]): Promise<{ quotes: QuoteData[]; errors: { symbol: string; error: string }[] }>;
}

export function computeChange(price: number, prev: number | null) {
  if (prev === null || !Number.isFinite(prev) || prev === 0) return { change: null, changePct: null };
  const change = price - prev;
  return { change, changePct: (change / prev) * 100 };
}

/** Runs tasks with bounded concurrency. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = { status: "fulfilled", value: await fn(items[idx]) }; }
      catch (e) { out[idx] = { status: "rejected", reason: e }; }
    }
  });
  await Promise.all(workers);
  return out;
}
