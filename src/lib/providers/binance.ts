import { fetchWithRetry } from "../http";
import { pool, type QuoteData, type QuoteProvider } from "./types";

/**
 * Binance public API (no key, free, real-time). USDT pairs ≈ USD.
 * Change = rolling 24h (crypto has no official close).
 */
const BASE = "https://api.binance.com/api/v3";

interface Ticker24 { symbol: string; lastPrice: string; prevClosePrice: string; openPrice: string; highPrice: string; lowPrice: string; closeTime: number; priceChange: string; priceChangePercent: string }

export const binanceProvider: QuoteProvider = {
  id: "binance",
  async getQuotes(symbols) {
    const settled = await pool(symbols, 3, async (s) => {
      const pair = s.providerSymbol ?? s.symbol;
      const [tRes, kRes] = await Promise.all([
        fetchWithRetry(`${BASE}/ticker/24hr?symbol=${pair}`),
        fetchWithRetry(`${BASE}/klines?symbol=${pair}&interval=15m&limit=96`),
      ]);
      const t = (await tRes.json()) as Ticker24;
      const k = (await kRes.json()) as Array<[number, string, string, string, string]>;
      const price = parseFloat(t.lastPrice);
      const open24 = parseFloat(t.openPrice);
      const q: QuoteData = {
        symbol: s.symbol,
        price,
        prevClose: open24,
        change: parseFloat(t.priceChange),
        changePct: parseFloat(t.priceChangePercent),
        dayHigh: parseFloat(t.highPrice),
        dayLow: parseFloat(t.lowPrice),
        currency: "USD",
        quoteTime: new Date(t.closeTime > Date.now() ? Date.now() : t.closeTime),
        exchangeTz: "UTC",
        latency: "realtime",
        provider: "binance",
        sparkline: k.map((b) => [Math.floor(b[0] / 1000), parseFloat(b[4])]),
      };
      return q;
    });
    const quotes: QuoteData[] = [];
    const errors: { symbol: string; error: string }[] = [];
    settled.forEach((r, i) => (r.status === "fulfilled" ? quotes.push(r.value) : errors.push({ symbol: symbols[i].symbol, error: String(r.reason?.message ?? r.reason) })));
    return { quotes, errors };
  },
};
