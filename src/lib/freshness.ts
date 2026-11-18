import type { MarketState } from "./marketHours";

/**
 * Honest qualification of a quote's freshness.
 * - live      : real-time feed (e.g. Binance) and data < 2 min old
 * - delayed   : market open, delayed but recent data (< 30 min)
 * - stale     : market open but data too old -> source problem
 * - close     : market closed, the last available data is displayed
 * - eod       : data published once a day (Treasury / ECB rates)
 */
export type Freshness = "live" | "delayed" | "stale" | "close" | "eod";

export interface FreshnessInput {
  latency: string; // realtime | delayed | eod (declared by the provider)
  quoteTime: Date | string;
  marketState: MarketState;
  now?: Date;
}

export function classifyFreshness({ latency, quoteTime, marketState, now = new Date() }: FreshnessInput): Freshness {
  if (latency === "eod" || marketState === "eod") return "eod";
  const ageMin = (now.getTime() - new Date(quoteTime).getTime()) / 60000;
  const open = marketState === "open" || marketState === "always";
  if (!open) return "close";
  if (latency === "realtime" && ageMin < 2) return "live";
  if (ageMin < 30) return "delayed";
  return "stale";
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  live: "Real time",
  delayed: "Delayed",
  stale: "Stale data",
  close: "Last close",
  eod: "Daily",
};
