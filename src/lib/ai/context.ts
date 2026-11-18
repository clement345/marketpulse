import { prisma } from "../db";
import { classifyFreshness, FRESHNESS_LABEL } from "../freshness";
import { DEFAULT_INSTRUMENTS, findInstrument } from "../instruments";
import { marketStatus } from "../marketHours";
import { fmtDateTime } from "../time";

/**
 * Builds the factual context provided to the AI. Everything the AI can cite comes from here:
 * each item carries an identifier ([N1], [E2], [Q]) linked to a real, timestamped source.
 */

export interface SourceRef { ref: string; title: string; url: string | null; source: string; date: string }

export async function quotesBlock(): Promise<{ text: string; sources: SourceRef[] }> {
  const quotes = await prisma.quote.findMany();
  const now = new Date();
  const lines = DEFAULT_INSTRUMENTS.map((inst) => {
    const q = quotes.find((x) => x.symbol === inst.symbol);
    if (!q) return `- ${inst.name}: DATA UNAVAILABLE`;
    const st = marketStatus(inst.exchange, now);
    const fr = classifyFreshness({ latency: q.latency, quoteTime: q.quoteTime, marketState: st.state, now });
    const chg = inst.assetClass === "rate"
      ? q.change !== null ? `${q.change >= 0 ? "+" : ""}${(q.change * 100).toFixed(1)} bp` : "n/a"
      : q.changePct !== null ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "n/a";
    return `- ${inst.name} (${inst.symbol}): ${q.price.toFixed(inst.decimals)}${inst.unit ?? ""} ${chg} | quote of ${fmtDateTime(q.quoteTime)} (Paris) | ${FRESHNESS_LABEL[fr]} | market: ${st.label} | source: ${q.provider}`;
  });
  return {
    text: `QUOTES (change vs previous close; crypto = rolling 24h; rates in basis points)\n${lines.join("\n")}`,
    sources: [{ ref: "Q", title: "MarketPulse Quotes", url: null, source: "Yahoo Finance / Binance / US Treasury / BCE", date: now.toISOString() }],
  };
}

const STOP = new Set("le la les un une des du de d l et ou en au aux pour par sur dans quel quelle quels quelles qui que quoi est sont a pourquoi comment combien cette ce ces cet aujourd hui semaine jour derniers dernières dernieres heures mes mon ma the of to and is are what why how today this week".split(" "));

const FR_EN: Record<string, string[]> = {
  fed: ["fed", "fomc", "powell", "federal reserve"], bce: ["ecb", "lagarde"], inflation: ["inflation", "cpi", "pce", "prices"],
  emploi: ["jobs", "payrolls", "unemployment", "labor"], "chômage": ["unemployment", "jobless"], taux: ["rates", "yields", "treasury"],
  "pétrole": ["oil", "crude", "opec", "brent"], or: ["gold"], dollar: ["dollar"], euro: ["euro", "ecb"], yen: ["yen", "boj"],
  nasdaq: ["nasdaq", "tech"], vix: ["vix", "volatility"], bitcoin: ["bitcoin", "crypto"], chine: ["china"], japon: ["japan", "boj"],
  "résultats": ["earnings", "results"], obligations: ["bonds", "treasury", "yields"], banque: ["bank"], "géopolitique": ["war", "sanctions", "tariffs"],
};

export function keywordsFor(question: string): string[] {
  const words = question.toLowerCase().replace(/[^\p{L}\p{N}&/$^.\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const out = new Set<string>();
  for (const w of words) {
    out.add(w.replace(/[?.!,]$/, ""));
    for (const [fr, en] of Object.entries(FR_EN)) if (w.startsWith(fr.slice(0, 5))) en.forEach((x) => out.add(x));
  }
  const inst = DEFAULT_INSTRUMENTS.find((i) => words.some((w) => i.short.toLowerCase() === w || i.name.toLowerCase().includes(w)));
  if (inst) out.add(inst.name.toLowerCase().split(" ")[0]);
  return [...out].slice(0, 14);
}

export async function newsBlock(opts: { question?: string; hours?: number; limit?: number; symbols?: string[] }): Promise<{ text: string; sources: SourceRef[] }> {
  const since = new Date(Date.now() - (opts.hours ?? 24) * 3600_000);
  const kws = opts.question ? keywordsFor(opts.question) : [];
  const or = [
    ...kws.flatMap((k) => [{ title: { contains: k, mode: "insensitive" as const } }, { summary: { contains: k, mode: "insensitive" as const } }]),
    ...(opts.symbols?.length ? [{ assets: { hasSome: opts.symbols } }] : []),
  ];
  const [matched, top] = await Promise.all([
    or.length ? prisma.newsItem.findMany({ where: { publishedAt: { gte: since }, isPrimary: true, OR: or }, orderBy: [{ importance: "desc" }, { publishedAt: "desc" }], take: 25 }) : Promise.resolve([]),
    prisma.newsItem.findMany({ where: { publishedAt: { gte: since }, isPrimary: true }, orderBy: [{ importance: "desc" }, { publishedAt: "desc" }], take: 15 }),
  ]);
  const seen = new Set<string>();
  const items = [...matched, ...top].filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))).slice(0, opts.limit ?? 30);
  const sources: SourceRef[] = [];
  const lines = items.map((n, i) => {
    const ref = `N${i + 1}`;
    sources.push({ ref, title: n.title, url: n.url, source: n.source, date: n.publishedAt.toISOString() });
    return `[${ref}] ${fmtDateTime(n.publishedAt)} | ${n.source} | importance ${n.importance}/5 | ${n.title}${n.summary ? ` — ${n.summary.slice(0, 280)}` : ""}`;
  });
  return { text: `NEWS (last ${opts.hours ?? 24} hours, headlines and summaries published by the sources)\n${lines.join("\n") || "No news available."}`, sources };
}

export async function eventsBlock(opts: { fromHours: number; toHours: number; minImportance?: number }): Promise<{ text: string; sources: SourceRef[] }> {
  const evs = await prisma.econEvent.findMany({
    where: {
      scheduledAt: { gte: new Date(Date.now() + opts.fromHours * 3600_000), lte: new Date(Date.now() + opts.toHours * 3600_000) },
      importance: { gte: opts.minImportance ?? 2 },
    },
    orderBy: { scheduledAt: "asc" }, take: 40,
  });
  const sources: SourceRef[] = [];
  const lines = evs.map((e, i) => {
    const ref = `E${i + 1}`;
    sources.push({ ref, title: e.title, url: e.sourceUrl, source: e.source, date: e.scheduledAt.toISOString() });
    const vals = [e.previous && `previous ${e.previous}`, e.consensus && `consensus ${e.consensus}`, e.actual ? `actual ${e.actual} (${e.actualSource})` : e.scheduledAt < new Date() ? "actual not available" : null].filter(Boolean).join(", ");
    return `[${ref}] ${fmtDateTime(e.scheduledAt)} (Paris) | ${e.country} | ${e.title} | importance ${e.importance}/3${vals ? ` | ${vals}` : ""}`;
  });
  return { text: `CALENDAR\n${lines.join("\n") || "No events."}`, sources };
}

export function instrumentName(symbol: string) {
  return findInstrument(symbol)?.name ?? symbol;
}

export const GROUNDING_RULES = `Mandatory rules:
- Answer in English.
- Use ONLY the data provided in the context. Never invent a figure, a quote, a consensus, a citation or a news item.
- Cite your sources with their identifiers in square brackets, e.g. [N3], [E1], [Q]. Every fact must be sourced.
- Clearly distinguish FACTS (sourced) from HYPOTHESES / theoretical mechanisms (to be phrased in the conditional).
- Never present a future consequence as certain. No personalized investment advice.
- If the requested information is not in the context, say so explicitly ("information not available in the retrieved data").
- Quotes may be delayed or correspond to a close: mention the timestamp when relevant.`;
