import { prisma } from "../db";
import { recordProvider } from "../http";
import { zonedDateKey } from "../time";
import { BLS_MAP, expectedRefMonth, fetchBlsSeries } from "./bls";
import { fetchCentralBankMeetings } from "./centralBanks";
import { fetchEarningsDay } from "./earnings";
import { fetchForexFactory, type CalEvent } from "./forexfactory";
import { computeSurprise } from "./parse";

async function safe<T>(id: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { const r = await fn(); await recordProvider(id, true); return r; }
  catch (e) { await recordProvider(id, false, e); return fallback; }
}

async function upsertEvents(events: CalEvent[]) {
  for (const e of events) {
    const existing = await prisma.econEvent.findUnique({ where: { id: e.id } });
    // never overwrite a known actual value with a missing value
    const actual = e.actual ?? existing?.actual ?? null;
    const actualSource = e.actual ? e.actualSource ?? e.source : existing?.actualSource ?? null;
    const consensus = e.consensus ?? existing?.consensus ?? null;
    const data = {
      kind: e.kind, title: e.title, country: e.country, scheduledAt: e.scheduledAt, allDay: e.allDay, importance: e.importance,
      previous: e.previous ?? existing?.previous ?? null, consensus, actual, actualSource,
      surprise: e.kind === "earnings" ? computeSurprise(actual, consensus) : computeSurprise(actual, consensus),
      ticker: e.ticker ?? null, source: e.source, sourceUrl: e.sourceUrl ?? null,
    };
    await prisma.econEvent.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
  }
}

/** Fills in the actual value of US indicators published via the official BLS API. */
export async function fillBlsActuals(): Promise<number> {
  const pending = await prisma.econEvent.findMany({
    where: { country: "USD", actual: null, source: "forexfactory", scheduledAt: { lte: new Date(), gte: new Date(Date.now() - 12 * 86400_000) } },
  });
  const targets = pending.filter((p) => BLS_MAP.some((m) => m.match.test(p.title)));
  if (!targets.length) return 0;
  const series = await safe("bls", fetchBlsSeries, null);
  if (!series) return 0;
  let n = 0;
  for (const ev of targets) {
    const rule = BLS_MAP.find((m) => m.match.test(ev.title))!;
    const r = rule.compute(series);
    // only assign the value if BLS has actually published the expected reference month
    if (!r || r.refMonth !== expectedRefMonth(ev.scheduledAt)) continue;
    await prisma.econEvent.update({
      where: { id: ev.id },
      data: { actual: r.value, actualSource: "bls", surprise: computeSurprise(r.value, ev.consensus) },
    });
    n++;
  }
  return n;
}

export async function ingestCalendar(watchTickers: string[] = []) {
  const ff = await safe("forexfactory", fetchForexFactory, [] as CalEvent[]);
  const cb = await safe("centralbanks", fetchCentralBankMeetings, [] as CalEvent[]);

  // earnings: D-3 (to pick up published EPS) to D+10
  const days: string[] = [];
  for (let i = -3; i <= 10; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    const k = zonedDateKey(d, "America/New_York");
    const wd = new Date(`${k}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(k);
  }
  const tickers = new Set(watchTickers);
  const earn: CalEvent[] = [];
  for (const day of [...new Set(days)]) {
    earn.push(...(await safe("nasdaq-earnings", () => fetchEarningsDay(day, { minCap: 30e9, tickers }), [] as CalEvent[])));
  }

  await upsertEvents([...ff, ...cb, ...earn]);
  const actuals = await fillBlsActuals();
  return { forexfactory: ff.length, centralBanks: cb.length, earnings: earn.length, blsActuals: actuals };
}
