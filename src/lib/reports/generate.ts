import { prisma } from "../db";
import { getAi } from "../ai/claude";
import { eventsBlock, GROUNDING_RULES, newsBlock, quotesBlock, type SourceRef } from "../ai/context";
import { DEFAULT_INSTRUMENTS, INDICES } from "../instruments";
import { formatParis, PARIS, zonedDateKey } from "../time";

export type ReportKind = "morning_brief" | "market_wrap";

export interface QuoteRow { symbol: string; name: string; price: number | null; changePct: number | null; changeBp: number | null; quoteTime: string | null; provider: string | null; unit?: string; decimals: number }
export interface ReportSection { title: string; type: "quotes" | "news" | "events" | "markdown"; quotes?: QuoteRow[]; news?: { title: string; url: string; source: string; date: string; importance: number }[]; events?: { title: string; country: string; date: string; previous: string | null; consensus: string | null; actual: string | null }[]; markdown?: string; empty?: string }
export interface ReportContent { title: string; kind: ReportKind; generatedAt: string; sections: ReportSection[]; sources: SourceRef[]; aiError?: string }

async function quoteRows(symbols: string[]): Promise<QuoteRow[]> {
  const qs = await prisma.quote.findMany({ where: { symbol: { in: symbols } } });
  return symbols.map((s) => {
    const inst = DEFAULT_INSTRUMENTS.find((i) => i.symbol === s)!;
    const q = qs.find((x) => x.symbol === s);
    return {
      symbol: s, name: inst?.name ?? s, decimals: inst?.decimals ?? 2, unit: inst?.unit,
      price: q?.price ?? null,
      changePct: inst?.assetClass === "rate" ? null : q?.changePct ?? null,
      changeBp: inst?.assetClass === "rate" && q?.change !== null && q?.change !== undefined ? q.change * 100 : null,
      quoteTime: q?.quoteTime.toISOString() ?? null, provider: q?.provider ?? null,
    };
  });
}

async function newsSince(since: Date, minImportance: number, take = 10) {
  const n = await prisma.newsItem.findMany({ where: { publishedAt: { gte: since }, isPrimary: true, importance: { gte: minImportance } }, orderBy: [{ importance: "desc" }, { publishedAt: "desc" }], take });
  return n.map((x) => ({ title: x.title, url: x.url, source: x.source, date: x.publishedAt.toISOString(), importance: x.importance }));
}

async function eventsBetween(from: Date, to: Date, minImportance = 2, kinds?: string[]) {
  const e = await prisma.econEvent.findMany({ where: { scheduledAt: { gte: from, lte: to }, importance: { gte: minImportance }, ...(kinds ? { kind: { in: kinds } } : {}) }, orderBy: { scheduledAt: "asc" }, take: 40 });
  return e.map((x) => ({ title: x.title, country: x.country, date: x.scheduledAt.toISOString(), previous: x.previous, consensus: x.consensus, actual: x.actual }));
}

function parisDayBounds(date: Date) {
  const key = zonedDateKey(date, PARIS);
  const [y, m, d] = key.split("-").map(Number);
  // bounds approximated to the Paris calendar day
  const start = new Date(new Date(Date.UTC(y, m - 1, d)).getTime() - 2 * 3600_000);
  return { key, start, end: new Date(start.getTime() + 26 * 3600_000) };
}

export async function generateReport(kind: ReportKind, now = new Date()): Promise<ReportContent> {
  const { key, start, end } = parisDayBounds(now);
  const sections: ReportSection[] = [];
  const us = INDICES.filter((i) => i.region === "US").map((i) => i.symbol);
  const eu = INDICES.filter((i) => i.region === "EU").map((i) => i.symbol);
  const asia = INDICES.filter((i) => i.region === "ASIA").map((i) => i.symbol);
  const cross = ["EURUSD=X", "JPY=X", "GBPUSD=X", "GC=F", "CL=F", "BZ=F", "BTC-USD", "ETH-USD", "^VIX"];
  const rates = ["US2Y", "US10Y", "EA2Y", "EA10Y"];

  if (kind === "morning_brief") {
    sections.push({ title: "Previous US session", type: "quotes", quotes: await quoteRows(us) });
    sections.push({ title: "Asian markets", type: "quotes", quotes: await quoteRows(asia) });
    sections.push({ title: "Currencies, commodities, crypto, volatility", type: "quotes", quotes: await quoteRows(cross) });
    sections.push({ title: "Rates (latest official fixing)", type: "quotes", quotes: await quoteRows(rates) });
    const overnight = await newsSince(new Date(now.getTime() - 10 * 3600_000), 3, 12);
    sections.push({ title: "Top overnight news", type: "news", news: overnight, empty: "No important news collected in the last 10 hours." });
    const today = await eventsBetween(now, end, 2, ["macro", "central_bank", "speech"]);
    sections.push({ title: "Today's macro calendar", type: "events", events: today, empty: "No medium or high importance events found in the calendar sources." });
    const earn = await eventsBetween(start, new Date(end.getTime() + 12 * 3600_000), 1, ["earnings"]);
    sections.push({ title: "Companies to watch (earnings)", type: "events", events: earn, empty: "No tracked earnings releases today." });
  } else {
    sections.push({ title: "US markets", type: "quotes", quotes: await quoteRows(us) });
    sections.push({ title: "European markets", type: "quotes", quotes: await quoteRows(eu) });
    const all = await quoteRows([...us, ...eu, ...asia, ...cross]);
    const movers = all.filter((r) => r.changePct !== null).sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!)).slice(0, 6);
    sections.push({ title: "Biggest movers", type: "quotes", quotes: movers });
    sections.push({ title: "Bonds, currencies, commodities", type: "quotes", quotes: await quoteRows([...rates, ...cross]) });
    sections.push({ title: "Key announcements of the day", type: "news", news: await newsSince(start, 3, 12), empty: "No important news collected today." });
    const tomorrow = await eventsBetween(end, new Date(end.getTime() + 24 * 3600_000), 2);
    sections.push({ title: "What to watch tomorrow", type: "events", events: tomorrow, empty: "No events found for tomorrow in the available sources." });
  }

  // AI summary (optional) — strictly grounded in the data above
  let sources: SourceRef[] = [];
  let aiError: string | undefined;
  const ai = getAi();
  if (ai) {
    try {
      const [q, n, ev] = await Promise.all([
        quotesBlock(),
        newsBlock({ hours: kind === "morning_brief" ? 12 : 16, limit: 30 }),
        eventsBlock({ fromHours: kind === "morning_brief" ? -1 : -14, toHours: kind === "morning_brief" ? 18 : 36, minImportance: 2 }),
      ]);
      const ask = kind === "morning_brief"
        ? `Write the Morning Brief summary (7:30 am, Paris):\n## Summary\n(4-6 bullets: what has happened since the US close, Asia, overnight news)\n## Points of attention for the European session\n(3-5 bullets: events of the day, risks, companies, with Paris times)\nStay factual and cite sources.`
        : `Write the Market Wrap summary (10:30 pm, Paris):\n## Key takeaways\n(4-6 bullets)\n## Explanation of the major moves\n(link market moves to the sourced news; if no news explains a move, say so)\n## What to watch tomorrow\n(2-4 bullets)`;
      const system = `You are writing a professional market report for a financial markets professional.\n${GROUNDING_RULES}`;
      const md = await ai.complete(system, `Date: ${formatParis(now, { dateStyle: "full", timeStyle: "short" })} (Paris)\n\n${q.text}\n\n${n.text}\n\n${ev.text}\n\n${ask}`);
      sections.unshift({ title: "AI Summary", type: "markdown", markdown: md });
      const all = [...q.sources, ...n.sources, ...ev.sources];
      const cited = new Set([...md.matchAll(/\[([^\]]{1,40})\]/g)].flatMap((m) => m[1].split(/[,;\s]+/)));
      sources = all.filter((s) => cited.has(s.ref));
    } catch (e) {
      aiError = (e as Error).message;
    }
  }

  const content: ReportContent = {
    title: kind === "morning_brief" ? `Morning Brief — ${formatParis(now, { dateStyle: "full" })}` : `Market Wrap — ${formatParis(now, { dateStyle: "full" })}`,
    kind, generatedAt: now.toISOString(), sections, sources, aiError,
  };
  await prisma.report.upsert({
    where: { kind_forDate: { kind, forDate: key } },
    create: { kind, forDate: key, content: content as object, aiUsed: !aiError && !!ai },
    update: { content: content as object, aiUsed: !aiError && !!ai, generatedAt: now },
  });
  return content;
}
