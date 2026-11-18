import { XMLParser } from "fast-xml-parser";
import { fetchWithRetry } from "../http";
import type { QuoteData, QuoteProvider } from "./types";

/**
 * U.S. Department of the Treasury — Daily Treasury Par Yield Curve Rates.
 * Official source, public domain, no key required. Published once per business day (late afternoon NY time).
 */
const URL = (yyyymm: string) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${yyyymm}`;

type Row = Record<string, unknown>;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseTreasuryXml(xml: string): { date: string; values: Record<string, number> }[] {
  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
  const doc = parser.parse(xml);
  let entries = doc?.feed?.entry ?? [];
  if (!Array.isArray(entries)) entries = [entries];
  return entries
    .map((e: Row) => {
      const p = ((e.content as Row)?.properties ?? {}) as Row;
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(p)) {
        if (k.startsWith("BC_")) {
          const n = typeof v === "number" ? v : parseFloat(String(v));
          if (Number.isFinite(n)) values[k] = n;
        }
      }
      return { date: String(p.NEW_DATE ?? "").slice(0, 10), values };
    })
    .filter((r: { date: string }) => r.date)
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
}

export const treasuryProvider: QuoteProvider = {
  id: "treasury",
  async getQuotes(symbols) {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const xmls = await Promise.all([monthKey(prev), monthKey(now)].map(async (m) => (await fetchWithRetry(URL(m), { timeoutMs: 20000 })).text()));
    const rows = xmls.flatMap(parseTreasuryXml);
    if (!rows.length) throw new Error("Treasury: no data");
    const quotes: QuoteData[] = [];
    const errors: { symbol: string; error: string }[] = [];
    for (const s of symbols) {
      const field = s.providerSymbol!;
      const series = rows.filter((r) => field in r.values);
      if (series.length < 1) { errors.push({ symbol: s.symbol, error: `field ${field} missing` }); continue; }
      const last = series[series.length - 1];
      const before = series.length > 1 ? series[series.length - 2] : null;
      const price = last.values[field];
      const prevClose = before ? before.values[field] : null;
      quotes.push({
        symbol: s.symbol, price, prevClose,
        change: prevClose !== null ? price - prevClose : null,
        // for a rate, "changePct" = change in basis points / 100 would make no sense: we keep the relative change
        changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : null,
        dayHigh: null, dayLow: null, currency: "%",
        // the curve is fixed at the New York close
        quoteTime: new Date(`${last.date}T21:00:00Z`),
        exchangeTz: "America/New_York", latency: "eod", provider: "treasury",
        sparkline: series.map((r) => [Math.floor(Date.parse(`${r.date}T21:00:00Z`) / 1000), r.values[field]]),
      });
    }
    return { quotes, errors };
  },
};
