import type { AlertRule, Quote } from "@prisma/client";
import { prisma } from "../db";
import { INDICES, findInstrument } from "../instruments";
import { fmtDateTime, PARIS, zonedDateKey } from "../time";
import { notify } from "./notify";

export const RULE_TYPES: Record<string, { label: string; needsSymbol: boolean; thresholdLabel?: string; defaultThreshold?: number }> = {
  price_above: { label: "Price above a threshold", needsSymbol: true, thresholdLabel: "Threshold" },
  price_below: { label: "Price below a threshold", needsSymbol: true, thresholdLabel: "Threshold" },
  pct_move: { label: "Large move (%)", needsSymbol: false, thresholdLabel: "Min. absolute change (%)", defaultThreshold: 2 },
  vix_spike: { label: "Sharp VIX spike", needsSymbol: false, thresholdLabel: "Min. VIX increase (%)", defaultThreshold: 10 },
  central_bank: { label: "New Fed / ECB announcement", needsSymbol: false },
  macro_upcoming: { label: "Upcoming macro event", needsSymbol: false, thresholdLabel: "Minutes before", defaultThreshold: 15 },
  earnings_watchlist: { label: "Earnings of a tracked stock", needsSymbol: false },
  asset_news: { label: "Important news on a tracked asset", needsSymbol: false, thresholdLabel: "Min. importance (1-5)", defaultThreshold: 4 },
};

export interface Hit { dedupKey: string; title: string; body: string; url?: string }

const dayKey = (d: Date) => zonedDateKey(d, PARIS);

/** Price rules: pure function (tested). */
export function evaluateQuoteRule(rule: Pick<AlertRule, "id" | "type" | "symbol" | "threshold">, quotes: Pick<Quote, "symbol" | "name" | "price" | "changePct" | "quoteTime">[], now = new Date()): Hit[] {
  const t = rule.threshold;
  const by = (s: string) => quotes.find((q) => q.symbol === s);
  const name = (q: { symbol: string; name: string }) => findInstrument(q.symbol)?.name ?? q.name;
  const hits: Hit[] = [];
  switch (rule.type) {
    case "price_above":
    case "price_below": {
      const q = rule.symbol ? by(rule.symbol) : undefined;
      if (!q || t === null) break;
      const crossed = rule.type === "price_above" ? q.price >= t : q.price <= t;
      if (crossed) hits.push({
        dedupKey: `${rule.id}:${dayKey(now)}`,
        title: `${name(q)} ${rule.type === "price_above" ? "≥" : "≤"} ${t}`,
        body: `Last price ${q.price} (quote ${fmtDateTime(q.quoteTime)}, Paris).`,
        url: `/asset/${encodeURIComponent(q.symbol)}`,
      });
      break;
    }
    case "pct_move": {
      const th = t ?? 2;
      const pool = rule.symbol ? [by(rule.symbol)].filter(Boolean) as typeof quotes : INDICES.map((i) => by(i.symbol)).filter(Boolean) as typeof quotes;
      for (const q of pool) {
        if (q.changePct !== null && Math.abs(q.changePct) >= th) {
          hits.push({
            dedupKey: `${rule.id}:${q.symbol}:${dayKey(q.quoteTime)}:${q.changePct > 0 ? "up" : "down"}`,
            title: `${name(q)} ${q.changePct > 0 ? "+" : ""}${q.changePct.toFixed(2)} %`,
            body: `Change ≥ ${th} % vs previous close. Price ${q.price} (quote ${fmtDateTime(q.quoteTime)}).`,
            url: `/asset/${encodeURIComponent(q.symbol)}`,
          });
        }
      }
      break;
    }
    case "vix_spike": {
      const q = by("^VIX");
      const th = t ?? 10;
      if (q && q.changePct !== null && q.changePct >= th) hits.push({
        dedupKey: `${rule.id}:${dayKey(q.quoteTime)}`,
        title: `VIX +${q.changePct.toFixed(1)} % (${q.price.toFixed(2)})`,
        body: `Sharp rise in implied volatility. Quote ${fmtDateTime(q.quoteTime)}.`,
        url: `/asset/%5EVIX`,
      });
      break;
    }
  }
  return hits;
}

async function watchSymbols(): Promise<string[]> {
  return [...new Set((await prisma.watchlistItem.findMany({ select: { symbol: true } })).map((x) => x.symbol))];
}

async function evaluateEventRule(rule: AlertRule, now: Date): Promise<Hit[]> {
  const since = new Date(Math.max(rule.createdAt.getTime(), now.getTime() - 6 * 3600_000));
  switch (rule.type) {
    case "central_bank": {
      const items = await prisma.newsItem.findMany({ where: { source: { in: ["Federal Reserve", "BCE"] }, fetchedAt: { gte: since }, publishedAt: { gte: new Date(now.getTime() - 24 * 3600_000) } }, orderBy: { publishedAt: "desc" }, take: 5 });
      return items.map((n) => ({ dedupKey: `${rule.id}:${n.id}`, title: `${n.source}: new publication`, body: n.title, url: n.url }));
    }
    case "macro_upcoming": {
      const mins = rule.threshold ?? 15;
      const evs = await prisma.econEvent.findMany({ where: { importance: 3, kind: { in: ["macro", "central_bank"] }, scheduledAt: { gt: now, lte: new Date(now.getTime() + mins * 60_000) } } });
      return evs.map((e) => ({
        dedupKey: `${rule.id}:${e.id}`, title: `In ${Math.round((e.scheduledAt.getTime() - now.getTime()) / 60000)} min: ${e.title} (${e.country})`,
        body: [e.consensus && `Consensus ${e.consensus}`, e.previous && `Previous ${e.previous}`].filter(Boolean).join(" · ") || "No consensus available.", url: "/calendar",
      }));
    }
    case "earnings_watchlist": {
      const syms = await watchSymbols();
      if (!syms.length) return [];
      const evs = await prisma.econEvent.findMany({ where: { kind: "earnings", ticker: { in: syms }, scheduledAt: { gte: new Date(now.getTime() - 12 * 3600_000), lte: new Date(now.getTime() + 24 * 3600_000) } } });
      return evs.map((e) => ({
        dedupKey: `${rule.id}:${e.id}:${e.actual ? "out" : "soon"}`,
        title: e.actual ? `${e.ticker}: EPS reported ${e.actual} (consensus ${e.consensus ?? "n/a"})` : `${e.title} — ${fmtDateTime(e.scheduledAt)}`,
        body: e.actual ? `Surprise: ${e.surprise ?? "n/a"}` : `EPS consensus: ${e.consensus ?? "n/a"}`, url: "/calendar",
      }));
    }
    case "asset_news": {
      const syms = rule.symbol ? [rule.symbol] : await watchSymbols();
      if (!syms.length) return [];
      const items = await prisma.newsItem.findMany({ where: { assets: { hasSome: syms }, importance: { gte: rule.threshold ?? 4 }, isPrimary: true, fetchedAt: { gte: since } }, orderBy: { publishedAt: "desc" }, take: 5 });
      return items.map((n) => ({ dedupKey: `${rule.id}:${n.id}`, title: `${n.assets.filter((a) => syms.includes(a)).join(", ")} — ${n.source}`, body: n.title, url: n.url }));
    }
  }
  return [];
}

export async function runAlerts(now = new Date()): Promise<number> {
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } });
  if (!rules.length) return 0;
  const quotes = await prisma.quote.findMany();
  let sent = 0;
  for (const rule of rules) {
    const isQuote = ["price_above", "price_below", "pct_move", "vix_spike"].includes(rule.type);
    // cooldown: avoids re-notifying the same rule too often
    if (isQuote && rule.lastTriggered && now.getTime() - rule.lastTriggered.getTime() < rule.cooldownMin * 60_000) continue;
    const hits = isQuote ? evaluateQuoteRule(rule, quotes, now) : await evaluateEventRule(rule, now);
    let fired = false;
    for (const h of hits.slice(0, 5)) {
      if (await notify({ ruleId: rule.id, dedupKey: h.dedupKey, title: h.title, body: h.body, url: h.url, priority: rule.priority, channels: rule.channels })) { sent++; fired = true; }
    }
    if (fired) await prisma.alertRule.update({ where: { id: rule.id }, data: { lastTriggered: now } });
  }
  return sent;
}

/** Default rules created on first launch. */
export async function seedDefaultRules() {
  if (await prisma.alertRule.count()) return;
  await prisma.alertRule.createMany({
    data: [
      { name: "Index ±2 %", type: "pct_move", threshold: 2, priority: 2, cooldownMin: 120 },
      { name: "VIX +10 %", type: "vix_spike", threshold: 10, priority: 3, cooldownMin: 240 },
      { name: "Fed / ECB announcements", type: "central_bank", priority: 2, cooldownMin: 0 },
      { name: "Major macro in 15 min", type: "macro_upcoming", threshold: 15, priority: 2, cooldownMin: 0 },
      { name: "Watchlist earnings", type: "earnings_watchlist", priority: 2, cooldownMin: 0 },
      { name: "Important news on the watchlist", type: "asset_news", threshold: 4, priority: 2, cooldownMin: 0 },
    ],
  });
}
