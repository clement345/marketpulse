import "dotenv/config";
import { autoAnalyze } from "@/lib/ai/analysis";
import { runAlerts, seedDefaultRules } from "@/lib/alerts/engine";
import { ingestCalendar } from "@/lib/calendar/ingest";
import { prisma } from "@/lib/db";
import { ingestNews } from "@/lib/news/ingest";
import { refreshQuotes } from "@/lib/quotesService";
import { generateReport, type ReportKind } from "@/lib/reports/generate";
import { PARIS, zonedDateKey, zonedMinutes } from "@/lib/time";

/**
 * Ingestion process (separate from the web server):
 * quotes (60 s), rates (30 min), news (3 min), calendar (30 min), alerts (60 s),
 * auto AI analyses (5 min, capped), Morning Brief 07:30 and Market Wrap 22:30 (Paris).
 */

const env = (k: string, d: number) => parseInt(process.env[k] || "", 10) || d;
const QUOTES_MS = env("QUOTES_INTERVAL_SEC", 60) * 1000;
const NEWS_MS = env("NEWS_INTERVAL_SEC", 180) * 1000;
const CAL_MS = env("CALENDAR_INTERVAL_SEC", 1800) * 1000;
const RATES_MS = 30 * 60_000;

const log = (tag: string, ...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), `[${tag}]`, ...a);

async function watchSymbols() {
  const items = await prisma.watchlistItem.findMany({ select: { symbol: true, name: true } });
  const m = new Map(items.map((i) => [i.symbol, i]));
  return [...m.values()];
}

const running = new Set<string>();
async function job(name: string, fn: () => Promise<unknown>) {
  if (running.has(name)) return; // no overlap
  running.add(name);
  const t0 = Date.now();
  try {
    const r = await fn();
    log(name, JSON.stringify(r), `${Date.now() - t0} ms`);
  } catch (e) {
    log(name, "ERROR", (e as Error).message);
  } finally {
    running.delete(name);
  }
}

const jobs = {
  quotes: () => job("quotes", async () => refreshQuotes({ include: "market", extraSymbols: await watchSymbols() })),
  rates: () => job("rates", () => refreshQuotes({ include: "rates" })),
  news: () => job("news", async () => ingestNews((await watchSymbols()).map((s) => s.symbol))),
  calendar: () => job("calendar", async () => ingestCalendar((await watchSymbols()).map((s) => s.symbol))),
  alerts: () => job("alerts", async () => ({ sent: await runAlerts() })),
  ai: () => job("ai", async () => ({ analysed: await autoAnalyze() })),
  reports: () => job("reports", maybeGenerateReports),
};

/** Generates the report if it is time and it does not yet exist for today (catch-up if the worker starts late). */
async function maybeGenerateReports() {
  const now = new Date();
  const min = zonedMinutes(now, PARIS);
  const day = zonedDateKey(now, PARIS);
  const due: ReportKind[] = [];
  if (min >= 7 * 60 + 30 && min < 11 * 60) due.push("morning_brief");
  if (min >= 22 * 60 + 30) due.push("market_wrap");
  const done: string[] = [];
  for (const kind of due) {
    const exists = await prisma.report.findUnique({ where: { kind_forDate: { kind, forDate: day } } });
    if (exists) continue;
    await generateReport(kind, now);
    done.push(kind);
  }
  return { generated: done };
}

async function seed() {
  await seedDefaultRules();
  if (!(await prisma.watchlist.count())) {
    await prisma.watchlist.create({
      data: {
        name: "Main",
        items: { create: ["AAPL", "NVDA", "MSFT", "MC.PA", "ASML"].map((symbol, position) => ({ symbol, position })) },
      },
    });
  }
}

async function main() {
  await seed();
  const once = process.argv.includes("--once");
  log("worker", once ? "single run" : "starting", { QUOTES_MS, NEWS_MS, CAL_MS });
  await Promise.all([jobs.quotes(), jobs.rates(), jobs.news(), jobs.calendar()]);
  await jobs.alerts();
  if (once) {
    await prisma.$disconnect();
    return;
  }
  await jobs.reports();
  setInterval(jobs.quotes, QUOTES_MS);
  setInterval(jobs.rates, RATES_MS);
  setInterval(jobs.news, NEWS_MS);
  setInterval(jobs.calendar, CAL_MS);
  setInterval(jobs.alerts, 60_000);
  setInterval(jobs.ai, 5 * 60_000);
  setInterval(jobs.reports, 60_000);
  setTimeout(jobs.ai, 20_000);
}

process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
main().catch((e) => { console.error(e); process.exit(1); });
