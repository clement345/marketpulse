import { fetchWithRetry } from "../http";
import { slug } from "./parse";

/**
 * Economic calendar for the current week (Forex Factory / Fair Economy, public JSON export).
 * Provides: time, country (currency code), importance, consensus ("forecast"), previous.
 * Does NOT provide the actual value -> filled in via official sources (BLS) when possible.
 * License: public export feed, personal use. Covers the current week only.
 */
const URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

interface FFEvent { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; actual?: string; url?: string }

export interface CalEvent {
  id: string; kind: string; title: string; country: string; scheduledAt: Date; allDay: boolean; importance: number;
  previous: string | null; consensus: string | null; actual: string | null; actualSource?: string | null;
  ticker?: string | null; source: string; sourceUrl?: string | null;
}

const IMPACT: Record<string, number> = { High: 3, Medium: 2, Low: 1, Holiday: 0, "Non-Economic": 1 };

export function classifyKind(title: string): string {
  if (/\b(speaks|testifies|press conference|remarks)\b/i.test(title)) return "speech";
  if (/\b(rate statement|interest rate|monetary policy|fomc|federal funds|cash rate|refinancing rate|deposit rate|bank rate|policy rate|boj|meeting minutes|economic projections)\b/i.test(title)) return "central_bank";
  return "macro";
}

export function mapFF(e: FFEvent): CalEvent | null {
  const d = new Date(e.date);
  if (Number.isNaN(d.getTime())) return null;
  return {
    id: `ff:${e.country}:${d.toISOString().slice(0, 16)}:${slug(e.title)}`,
    kind: classifyKind(e.title),
    title: e.title,
    country: e.country,
    scheduledAt: d,
    allDay: false,
    importance: IMPACT[e.impact] ?? 1,
    previous: e.previous || null,
    consensus: e.forecast || null,
    actual: e.actual || null,
    actualSource: e.actual ? "forexfactory" : null,
    source: "forexfactory",
    sourceUrl: e.url ?? null,
  };
}

export async function fetchForexFactory(): Promise<CalEvent[]> {
  const res = await fetchWithRetry(URL, { retries: 1 });
  const json = (await res.json()) as FFEvent[];
  return json.map(mapFF).filter((x): x is CalEvent => !!x && x.importance > 0);
}
