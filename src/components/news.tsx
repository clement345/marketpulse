"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Bot, ExternalLink, Layers, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "@/lib/news/classify";
import { findInstrument } from "@/lib/instruments";
import { fmtDateTime, relativeAge } from "@/lib/time";
import type { AnalysisContent } from "@/lib/ai/analysis";
import { postJson } from "./live";
import { Badge, Button, Empty, Spinner } from "./ui";

export interface NewsDTO {
  id: string; url: string; title: string; summary: string | null; source: string; publishedAt: string; fetchedAt: string;
  category: string; countries: string[]; assets: string[]; importance: number; isBreaking: boolean; favorite: boolean;
  hasAnalysis: boolean; related: { source: string; url: string; title: string; publishedAt: string }[];
}

export function ImportanceBars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-px" title={`Importance ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-sm", i <= n ? (n >= 4 ? "bg-down" : n === 3 ? "bg-accent" : "bg-muted") : "bg-line-2")} style={{ height: 3 + i * 2 }} />
      ))}
    </span>
  );
}

export function assetLabel(sym: string) {
  return findInstrument(sym)?.short ?? sym;
}

export function NewsRow({ n, onChanged, compact }: { n: NewsDTO; onChanged?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [fav, setFav] = useState(n.favorite);
  // the displayed date is the one published by the source; never presented as "real time"
  const lag = Math.round((new Date(n.fetchedAt).getTime() - new Date(n.publishedAt).getTime()) / 60000);
  return (
    <article className={cn("border-b border-line px-3 py-2 hover:bg-panel-2/60", n.importance >= 4 && "border-l-2 border-l-down")}>
      <div className="flex items-center gap-2 text-[11px] text-dim">
        <ImportanceBars n={n.importance} />
        <span className="font-medium text-muted">{n.source}</span>
        <span className="num" title={`Published: ${fmtDateTime(n.publishedAt)} — received: ${fmtDateTime(n.fetchedAt)}${lag > 5 ? ` (received ${lag} min after publication)` : ""}`}>
          {fmtDateTime(n.publishedAt)} · {relativeAge(n.publishedAt)}
        </span>
        {!compact && <Badge>{CATEGORY_LABEL[n.category] ?? n.category}</Badge>}
        {n.related.length > 0 && <Badge tone="info" title={n.related.map((r) => r.source).join(", ")}><Layers size={9} />+{n.related.length} source{n.related.length > 1 ? "s" : ""}</Badge>}
        <span className="ml-auto flex items-center gap-1">
          <button title="AI analysis" onClick={() => setOpen((o) => !o)} className={cn("rounded p-0.5 hover:text-fg", n.hasAnalysis ? "text-accent" : "text-dim")}><Bot size={13} /></button>
          <button title="Favorite" onClick={async () => { const r = await postJson<{ favorite: boolean }>(`/api/news/${n.id}/favorite`); setFav(r.favorite); onChanged?.(); }} className={cn("rounded p-0.5 hover:text-fg", fav ? "text-accent" : "text-dim")}>
            <Star size={13} fill={fav ? "currentColor" : "none"} />
          </button>
        </span>
      </div>
      <a href={n.url} target="_blank" rel="noreferrer" className="group mt-1 flex items-start gap-1 text-[13px] font-medium leading-snug text-fg hover:text-accent">
        {n.title}<ExternalLink size={11} className="mt-1 shrink-0 opacity-0 group-hover:opacity-60" />
      </a>
      {!compact && n.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.summary}</p>}
      {(n.assets.length > 0 || (!compact && n.countries.length > 0)) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {n.assets.slice(0, 8).map((a) => <Link key={a} href={`/asset/${encodeURIComponent(a)}`}><Badge tone="accent" className="normal-case">{assetLabel(a)}</Badge></Link>)}
          {!compact && n.countries.map((c) => <Badge key={c} tone="muted">{c}</Badge>)}
        </div>
      )}
      {open && <AnalysisPanel newsId={n.id} />}
      {open && n.related.length > 0 && (
        <div className="mt-2 space-y-0.5 border-l border-line-2 pl-2">
          <div className="text-[10px] uppercase tracking-wide text-dim">Same event</div>
          {n.related.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-muted hover:text-fg">{r.source} — {r.title}</a>)}
        </div>
      )}
    </article>
  );
}

const DIRECTION_TONE = { up: "up", down: "down", uncertain: "default", "mixed": "accent" } as const;

export function AnalysisPanel({ newsId }: { newsId: string }) {
  const { data, mutate, isLoading } = useSWR<{ analysis: { content: AnalysisContent; model: string; createdAt: string } | null }>(`/api/news/${newsId}/analysis`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null);
    try { await mutate(await postJson(`/api/news/${newsId}/analysis`), { revalidate: false }); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  if (isLoading) return <div className="mt-2"><Spinner /></div>;
  const a = data?.analysis?.content;
  if (!a) {
    return (
      <div className="mt-2 rounded border border-line-2 bg-bg p-2 text-xs">
        <div className="flex items-center gap-2">
          <Button variant="accent" size="xs" onClick={run} disabled={busy}>{busy ? <><Spinner /> Analysis in progress (≈20-60 s)…</> : <><Bot size={12} /> Analyze with AI</>}</Button>
          <span className="text-[11px] text-dim">Based solely on the published title and summary + the collected quotes.</span>
        </div>
        {err && <div className="mt-1 text-down">{err}</div>}
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded border border-accent/25 bg-bg p-3 text-xs leading-relaxed">
      <div className="flex items-center justify-between text-[10px] text-dim">
        <span>AI analysis · {data!.analysis!.model} · {fmtDateTime(data!.analysis!.createdAt)}</span>
        <span className="flex items-center gap-2">
          <Badge tone={a.uncertainty === "high" ? "down" : a.uncertainty === "medium" ? "accent" : "up"}>Uncertainty {a.uncertainty}</Badge>
          <button className="hover:text-fg" onClick={run} disabled={busy}>{busy ? "…" : "Regenerate"}</button>
        </span>
      </div>
      <p className="text-fg">{a.summary}</p>
      <Section title="Explanation">{a.explanation}</Section>
      <Section title="Why it matters">{a.why_it_matters}</Section>
      {a.assets.length > 0 && (
        <Section title="Potentially affected assets">
          <ul className="space-y-1">
            {a.assets.map((x, i) => <li key={i} className="flex gap-2"><Badge tone={DIRECTION_TONE[x.direction] ?? "default"} className="shrink-0">{x.direction}</Badge><span><strong className="text-fg">{x.asset}</strong> — {x.potential_effect}</span></li>)}
          </ul>
        </Section>
      )}
      {a.mechanisms.length > 0 && <Section title="Mechanisms"><ul className="list-disc pl-4">{a.mechanisms.map((m, i) => <li key={i}>{m}</li>)}</ul></Section>}
      <div className="grid gap-2 md:grid-cols-3">
        <Scenario tone="up" title="Bullish scenario" text={a.scenarios.bullish} />
        <Scenario tone="muted" title="Neutral scenario" text={a.scenarios.neutral} />
        <Scenario tone="down" title="Bearish scenario" text={a.scenarios.bearish} />
      </div>
      {a.different_reaction_conditions && <Section title="The market could react differently if…">{a.different_reaction_conditions}</Section>}
      {a.uncertainty_explanation && <Section title="Uncertainty">{a.uncertainty_explanation}</Section>}
      <div className="grid gap-2 md:grid-cols-2">
        <Section title="Facts (sources)"><ul className="list-disc pl-4">{a.facts.map((m, i) => <li key={i}>{m}</li>)}</ul></Section>
        <Section title="Assumptions (analysis)"><ul className="list-disc pl-4 italic">{a.assumptions.map((m, i) => <li key={i}>{m}</li>)}</ul></Section>
      </div>
      <Section title="Sources used">
        {a.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block truncate text-info">{s.source} · {fmtDateTime(s.date)} — {s.title}</a>)}
      </Section>
      <p className="text-[10px] text-dim">Automatically generated analysis, for educational purposes: the effects described are possible, not certain. Not investment advice.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-dim">{title}</div><div className="text-muted">{children}</div></div>;
}
function Scenario({ title, text, tone }: { title: string; text: string; tone: "up" | "down" | "muted" }) {
  return (
    <div className={cn("rounded border p-2", tone === "up" ? "border-up/30" : tone === "down" ? "border-down/30" : "border-line-2")}>
      <div className={cn("mb-0.5 text-[10px] font-semibold uppercase", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted")}>{title}</div>
      <div className="text-muted">{text}</div>
    </div>
  );
}

export function NewsFeed({ query, compact, empty }: { query: string; compact?: boolean; empty?: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ items: NewsDTO[] }>(`/api/news?${query}`, { refreshInterval: 120_000 });
  if (isLoading) return <Empty><Spinner /></Empty>;
  if (error) return <Empty>Error: {error.message}</Empty>;
  if (!data?.items.length) return <Empty>{empty ?? "No news."}</Empty>;
  return <div>{data.items.map((n) => <NewsRow key={n.id} n={n} compact={compact} onChanged={() => mutate()} />)}</div>;
}
