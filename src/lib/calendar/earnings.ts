import { fetchWithRetry } from "../http";
import { zonedTimeToUtc } from "../time";
import type { CalEvent } from "./forexfactory";

/**
 * US earnings calendar — api.nasdaq.com (public endpoint of the nasdaq.com site, no key, undocumented).
 * EPS consensus, reported EPS and surprise once the release has passed. Exact time not provided:
 * only "before market open" / "after market close".
 */
interface Row { symbol: string; name: string; marketCap: string; time: string; epsForecast?: string; lastYearEPS?: string; eps?: string; surprise?: string; fiscalQuarterEnding?: string }

const SESSION: Record<string, string> = { "time-pre-market": "before market open", "time-after-hours": "after market close" };

function capOf(s: string) { return parseInt((s || "0").replace(/[$,]/g, ""), 10) || 0; }

export async function fetchEarningsDay(date: string, opts: { minCap: number; tickers: Set<string> }): Promise<CalEvent[]> {
  const res = await fetchWithRetry(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, { retries: 1, headers: { Accept: "application/json" } });
  const json = (await res.json()) as { data?: { rows?: Row[] | null } };
  const rows = json.data?.rows ?? [];
  const [y, m, d] = date.split("-").map(Number);
  return rows
    .filter((r) => capOf(r.marketCap) >= opts.minCap || opts.tickers.has(r.symbol))
    .map((r) => {
      const session = SESSION[r.time];
      // indicative time: 08:00 NY (before market open), 16:05 NY (after market close), otherwise all day
      const at = r.time === "time-pre-market" ? zonedTimeToUtc(y, m, d, 8, 0, "America/New_York")
        : r.time === "time-after-hours" ? zonedTimeToUtc(y, m, d, 16, 5, "America/New_York")
        : zonedTimeToUtc(y, m, d, 12, 0, "America/New_York");
      const cap = capOf(r.marketCap);
      return {
        id: `earn:${r.symbol}:${date}`,
        kind: "earnings",
        title: `Earnings ${r.name.replace(/,? Inc\.?|,? Corp(oration)?\.?|\(The\)/g, "").trim()} (${r.symbol})${session ? ` — ${session}` : ""}`,
        country: "USD",
        scheduledAt: at,
        allDay: !session,
        importance: cap >= 200e9 ? 3 : cap >= 50e9 ? 2 : 1,
        previous: r.lastYearEPS && r.lastYearEPS !== "N/A" ? r.lastYearEPS : null,
        consensus: r.epsForecast && r.epsForecast !== "N/A" ? r.epsForecast : null,
        actual: r.eps || null,
        actualSource: r.eps ? "nasdaq" : null,
        ticker: r.symbol,
        source: "nasdaq",
        sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${r.symbol.toLowerCase()}/earnings`,
      } satisfies CalEvent;
    });
}
