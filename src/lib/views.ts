import type { Quote } from "@prisma/client";
import { classifyFreshness, type Freshness } from "./freshness";
import { findInstrument, type Instrument } from "./instruments";
import { marketStatus, type MarketStatus } from "./marketHours";

export interface QuoteView {
  symbol: string; name: string; short: string; assetClass: string; region: string;
  price: number; prevClose: number | null; change: number | null; changePct: number | null; changeBp: number | null;
  dayHigh: number | null; dayLow: number | null; currency: string | null; unit: string | null; decimals: number;
  quoteTime: string; fetchedAt: string; provider: string; latency: string;
  market: MarketStatus; freshness: Freshness; sparkline: [number, number][];
}

function exchangeFor(q: Quote, inst?: Instrument) {
  if (inst) return inst.exchange;
  const tz = q.exchangeTz ?? "";
  if (tz.startsWith("Europe/Paris") || tz.startsWith("Europe/Amsterdam")) return "EURONEXT" as const;
  if (tz.startsWith("Europe/")) return "XETRA" as const;
  if (tz === "Asia/Tokyo") return "JPX" as const;
  if (tz === "Asia/Hong_Kong") return "HKEX" as const;
  if (q.symbol.endsWith("-USD")) return "CRYPTO" as const;
  if (q.symbol.endsWith("=X")) return "FX" as const;
  if (q.symbol.endsWith("=F")) return "CME" as const;
  return "NYSE" as const;
}

export function toQuoteView(q: Quote, now = new Date()): QuoteView {
  const inst = findInstrument(q.symbol);
  const market = marketStatus(exchangeFor(q, inst), now);
  const isRate = q.assetClass === "rate";
  return {
    symbol: q.symbol, name: inst?.name ?? q.name, short: inst?.short ?? q.symbol, assetClass: q.assetClass, region: inst?.region ?? "GLOBAL",
    price: q.price, prevClose: q.prevClose, change: q.change, changePct: isRate ? null : q.changePct,
    changeBp: isRate && q.change !== null ? q.change * 100 : null,
    dayHigh: q.dayHigh, dayLow: q.dayLow, currency: q.currency, unit: inst?.unit ?? null, decimals: inst?.decimals ?? 2,
    quoteTime: q.quoteTime.toISOString(), fetchedAt: q.fetchedAt.toISOString(), provider: q.provider, latency: q.latency,
    market, freshness: classifyFreshness({ latency: q.latency, quoteTime: q.quoteTime, marketState: market.state, now }),
    sparkline: (q.sparkline as [number, number][] | null) ?? [],
  };
}
