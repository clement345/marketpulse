import { fetchWithRetry } from "../http";
import type { QuoteData, QuoteProvider } from "./types";

/**
 * ECB — Data Portal (SDMX), euro area yield curve (AAA-rated government bonds, Svensson).
 * Free official source, no key required. Published daily (TARGET business day), D+1 around noon.
 * Note: this is NOT the continuously quoted German Bund, but the official ECB indicator.
 */
const URL = (keys: string) =>
  `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${keys}?lastNObservations=30&format=csvdata`;

export function parseEcbCsv(csv: string): Record<string, { date: string; value: number }[]> {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift()!.split(",");
  const iKey = header.indexOf("KEY"), iDate = header.indexOf("TIME_PERIOD"), iVal = header.indexOf("OBS_VALUE");
  const out: Record<string, { date: string; value: number }[]> = {};
  for (const l of lines) {
    const c = l.split(",");
    const series = c[iKey].split(".").pop()!;
    const v = parseFloat(c[iVal]);
    if (!Number.isFinite(v)) continue;
    (out[series] ??= []).push({ date: c[iDate], value: v });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export const ecbProvider: QuoteProvider = {
  id: "ecb",
  async getQuotes(symbols) {
    const keys = symbols.map((s) => s.providerSymbol!).join("+");
    const csv = await (await fetchWithRetry(URL(keys), { timeoutMs: 20000 })).text();
    const data = parseEcbCsv(csv);
    const quotes: QuoteData[] = [];
    const errors: { symbol: string; error: string }[] = [];
    for (const s of symbols) {
      const series = data[s.providerSymbol!];
      if (!series?.length) { errors.push({ symbol: s.symbol, error: "series missing" }); continue; }
      const last = series[series.length - 1];
      const prev = series.length > 1 ? series[series.length - 2].value : null;
      quotes.push({
        symbol: s.symbol, price: last.value, prevClose: prev,
        change: prev !== null ? last.value - prev : null,
        changePct: prev ? ((last.value - prev) / prev) * 100 : null,
        dayHigh: null, dayLow: null, currency: "%",
        quoteTime: new Date(`${last.date}T16:00:00Z`),
        exchangeTz: "Europe/Frankfurt", latency: "eod", provider: "ecb",
        sparkline: series.map((p) => [Math.floor(Date.parse(`${p.date}T16:00:00Z`) / 1000), p.value]),
      });
    }
    return { quotes, errors };
  },
};
