import { fetchWithRetry } from "../http";
import { computeChange, pool, type HistoryBar, type QuoteData, type QuoteProvider } from "./types";

/**
 * Yahoo Finance — undocumented public endpoint (v8/chart). Free, no key required.
 * License: personal non-commercial use only; data is generally delayed
 * (up to 15-20 min depending on the exchange). Entry point query2 (query1 often returns 429).
 */
const BASE = "https://query2.finance.yahoo.com/v8/finance/chart/";

interface YahooChart {
  chart: {
    result?: Array<{
      meta: {
        symbol: string; currency?: string; regularMarketPrice: number; chartPreviousClose?: number; previousClose?: number;
        regularMarketTime: number; regularMarketDayHigh?: number; regularMarketDayLow?: number;
        exchangeTimezoneName?: string; longName?: string; shortName?: string; instrumentType?: string;
      };
      timestamp?: number[];
      indicators: { quote: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
    error?: { code: string; description: string } | null;
  };
}

async function fetchChart(symbol: string, range: string, interval: string): Promise<YahooChart> {
  const url = `${BASE}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetchWithRetry(url, { timeoutMs: 10000 });
  const json = (await res.json()) as YahooChart;
  if (json.chart.error) throw new Error(`Yahoo ${symbol}: ${json.chart.error.description}`);
  if (!json.chart.result?.length) throw new Error(`Yahoo ${symbol}: empty result`);
  return json;
}

export function parseYahooQuote(json: YahooChart): QuoteData {
  const r = json.chart.result![0];
  const m = r.meta;
  if (typeof m.regularMarketPrice !== "number") throw new Error(`Yahoo ${m.symbol}: price missing`);
  const prev = m.chartPreviousClose ?? m.previousClose ?? null;
  const closes = r.indicators.quote[0]?.close ?? [];
  const spark: [number, number][] = [];
  (r.timestamp ?? []).forEach((t, i) => {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) spark.push([t, c]);
  });
  return {
    symbol: m.symbol,
    price: m.regularMarketPrice,
    prevClose: prev,
    ...computeChange(m.regularMarketPrice, prev),
    dayHigh: m.regularMarketDayHigh ?? null,
    dayLow: m.regularMarketDayLow ?? null,
    currency: m.currency ?? null,
    quoteTime: new Date(m.regularMarketTime * 1000),
    exchangeTz: m.exchangeTimezoneName ?? null,
    latency: "delayed",
    provider: "yahoo",
    sparkline: spark,
    name: m.longName || m.shortName,
  };
}

export const yahooProvider: QuoteProvider = {
  id: "yahoo",
  async getQuotes(symbols) {
    const settled = await pool(symbols, 4, async (s) => parseYahooQuote(await fetchChart(s.providerSymbol ?? s.symbol, "1d", "5m")));
    const quotes: QuoteData[] = [];
    const errors: { symbol: string; error: string }[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") quotes.push({ ...r.value, symbol: symbols[i].symbol });
      else errors.push({ symbol: symbols[i].symbol, error: String(r.reason?.message ?? r.reason) });
    });
    return { quotes, errors };
  },
};

const RANGE_INTERVAL: Record<string, string> = { "1d": "5m", "5d": "15m", "1mo": "1h", "6mo": "1d", "1y": "1d", "5y": "1wk", max: "1mo" };

export async function yahooHistory(symbol: string, range: string): Promise<{ bars: HistoryBar[]; tz: string | null; currency: string | null }> {
  const interval = RANGE_INTERVAL[range] ?? "1d";
  const json = await fetchChart(symbol, range in RANGE_INTERVAL ? range : "6mo", interval);
  const r = json.chart.result![0];
  const q = r.indicators.quote[0] ?? {};
  const bars: HistoryBar[] = [];
  (r.timestamp ?? []).forEach((t, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].every((v) => typeof v === "number" && Number.isFinite(v))) {
      bars.push({ time: t, open: o!, high: h!, low: l!, close: c!, volume: q.volume?.[i] ?? undefined });
    }
  });
  return { bars, tz: r.meta.exchangeTimezoneName ?? null, currency: r.meta.currency ?? null };
}

/** Checks that a symbol exists at Yahoo (when adding to a watchlist). */
export async function yahooLookup(symbol: string): Promise<QuoteData | null> {
  try { return parseYahooQuote(await fetchChart(symbol, "1d", "5m")); } catch { return null; }
}

/** Symbol search (autocomplete). Public Yahoo endpoint. */
export async function yahooSearch(q: string): Promise<{ symbol: string; name: string; type: string; exchange: string }[]> {
  const res = await fetchWithRetry(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`, { retries: 1 });
  const json = (await res.json()) as { quotes?: Array<{ symbol: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }> };
  return (json.quotes ?? []).filter((x) => x.symbol).map((x) => ({
    symbol: x.symbol, name: x.longname || x.shortname || x.symbol, type: x.quoteType ?? "", exchange: x.exchDisp ?? "",
  }));
}
