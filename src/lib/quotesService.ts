import { prisma } from "./db";
import { recordProvider } from "./http";
import { DEFAULT_INSTRUMENTS, findInstrument, type Instrument } from "./instruments";
import { binanceProvider } from "./providers/binance";
import { ecbProvider } from "./providers/ecb";
import { treasuryProvider } from "./providers/treasury";
import type { QuoteData, QuoteProvider } from "./providers/types";
import { yahooProvider } from "./providers/yahoo";

const PROVIDERS: Record<string, QuoteProvider> = {
  yahoo: yahooProvider,
  binance: binanceProvider,
  treasury: treasuryProvider,
  ecb: ecbProvider,
};

/** Fallback provider for each primary provider (null = none: we keep the last value, marked "stale"). */
const FALLBACK: Record<string, string | null> = { binance: "yahoo", yahoo: null, treasury: null, ecb: null };

type Target = { symbol: string; providerSymbol?: string; inst: Instrument | null; name: string; assetClass: string };

async function runProvider(providerId: string, targets: Target[]): Promise<{ quotes: QuoteData[]; failed: Target[] }> {
  const p = PROVIDERS[providerId];
  try {
    const { quotes, errors } = await p.getQuotes(targets.map((t) => ({ symbol: t.symbol, providerSymbol: t.providerSymbol })));
    await recordProvider(providerId, errors.length < targets.length, errors.length ? errors.map((e) => `${e.symbol}: ${e.error}`).join("; ") : undefined);
    const failed = targets.filter((t) => errors.some((e) => e.symbol === t.symbol));
    return { quotes, failed };
  } catch (e) {
    await recordProvider(providerId, false, e);
    return { quotes: [], failed: targets };
  }
}

async function saveQuote(q: QuoteData, t: Target) {
  const data = {
    name: t.name || q.name || q.symbol,
    assetClass: t.assetClass,
    currency: q.currency,
    price: q.price,
    prevClose: q.prevClose,
    change: q.change,
    changePct: q.changePct,
    dayHigh: q.dayHigh,
    dayLow: q.dayLow,
    quoteTime: q.quoteTime,
    fetchedAt: new Date(),
    provider: q.provider,
    latency: q.latency,
    exchangeTz: q.exchangeTz,
    sparkline: q.sparkline.slice(-300),
  };
  await prisma.quote.upsert({ where: { symbol: q.symbol }, create: { symbol: q.symbol, ...data }, update: data });
}

/** Refreshes quotes for the default instruments + additional symbols (watchlists). */
export async function refreshQuotes(opts: { include?: "all" | "market" | "rates"; extraSymbols?: { symbol: string; name?: string | null }[] } = {}) {
  const include = opts.include ?? "all";
  const targets: Target[] = [];
  for (const inst of DEFAULT_INSTRUMENTS) {
    const isRate = inst.assetClass === "rate";
    if (include === "market" && isRate) continue;
    if (include === "rates" && !isRate) continue;
    targets.push({ symbol: inst.symbol, providerSymbol: inst.providerSymbol, inst, name: inst.name, assetClass: inst.assetClass });
  }
  if (include !== "rates") {
    for (const x of opts.extraSymbols ?? []) {
      if (findInstrument(x.symbol) || targets.some((t) => t.symbol === x.symbol)) continue;
      targets.push({ symbol: x.symbol, inst: null, name: x.name ?? x.symbol, assetClass: "equity" });
    }
  }

  const byProvider = new Map<string, Target[]>();
  for (const t of targets) {
    const pid = t.inst?.provider ?? "yahoo";
    byProvider.set(pid, [...(byProvider.get(pid) ?? []), t]);
  }

  let ok = 0;
  const failedAll: string[] = [];
  await Promise.all(
    [...byProvider.entries()].map(async ([pid, ts]) => {
      const { quotes, failed } = await runProvider(pid, ts);
      for (const q of quotes) { await saveQuote(q, ts.find((t) => t.symbol === q.symbol)!); ok++; }
      const fb = FALLBACK[pid];
      if (failed.length && fb) {
        // the fallback uses the internal symbol (e.g. "BTC-USD" on Yahoo)
        const r = await runProvider(fb, failed.map((t) => ({ ...t, providerSymbol: undefined })));
        for (const q of r.quotes) { await saveQuote(q, failed.find((t) => t.symbol === q.symbol)!); ok++; }
        failedAll.push(...r.failed.map((t) => t.symbol));
      } else {
        failedAll.push(...failed.map((t) => t.symbol));
      }
    }),
  );
  return { ok, failed: failedAll };
}
