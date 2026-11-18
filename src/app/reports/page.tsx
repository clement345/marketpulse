"use client";
import { useState } from "react";
import useSWR from "swr";
import { RefreshCw } from "lucide-react";
import { cn, fmtNum, fmtSigned } from "@/lib/utils";
import { fmtDateTime, fmtTime, formatParis } from "@/lib/time";
import type { ReportContent, ReportSection } from "@/lib/reports/generate";
import { postJson } from "@/components/live";
import { Markdown } from "@/components/markdown";
import { FLAG } from "@/components/events";
import { Badge, Button, Chip, Empty, Panel, Spinner } from "@/components/ui";

interface ReportRow { id: string; kind: string; forDate: string; content: ReportContent; aiUsed: boolean; generatedAt: string }

function SectionView({ s, refs }: { s: ReportSection; refs: Record<string, { url: string | null; title: string }> }) {
  return (
    <section className="rounded border border-line bg-panel-2/30 p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-accent">{s.title}</h3>
      {s.type === "markdown" && s.markdown && <div className="text-xs"><Markdown text={s.markdown} refs={refs} /></div>}
      {s.type === "quotes" && (
        <table className="w-full text-xs"><tbody>
          {s.quotes!.map((q) => {
            const v = q.changeBp ?? q.changePct;
            return (
              <tr key={q.symbol} className="border-b border-line last:border-0">
                <td className="py-1">{q.name}</td>
                <td className="num py-1 text-right">{q.price === null ? <span className="text-dim">unavailable</span> : `${fmtNum(q.price, q.decimals)}${q.unit ?? ""}`}</td>
                <td className={cn("num py-1 text-right", v === null ? "text-dim" : v > 0 ? "text-up" : v < 0 ? "text-down" : "")}>{q.changeBp !== null ? fmtSigned(q.changeBp, 1, " bp") : fmtSigned(q.changePct, 2, "%")}</td>
                <td className="num py-1 text-right text-[10px] text-dim">{q.quoteTime ? fmtDateTime(q.quoteTime) : ""}</td>
              </tr>
            );
          })}
        </tbody></table>
      )}
      {s.type === "news" && (s.news!.length ? s.news!.map((n) => (
        <a key={n.url} href={n.url} target="_blank" rel="noreferrer" className="block border-b border-line py-1 text-xs last:border-0 hover:text-accent">
          <span className="num mr-2 text-[10px] text-dim">{fmtTime(n.date)}</span><span className="mr-2 text-[10px] text-muted">{n.source}</span>{n.title}
        </a>
      )) : <div className="text-xs text-dim">{s.empty}</div>)}
      {s.type === "events" && (s.events!.length ? (
        <table className="w-full text-xs"><tbody>
          {s.events!.map((e, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="num py-1 pr-2 text-[11px] text-dim">{fmtTime(e.date)}</td><td className="pr-1">{FLAG[e.country] ?? e.country}</td><td className="py-1">{e.title}</td>
              <td className="num text-right text-[11px] text-muted">{[e.actual && `actual ${e.actual}`, e.consensus && `cons. ${e.consensus}`, e.previous && `prev. ${e.previous}`].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
        </tbody></table>
      ) : <div className="text-xs text-dim">{s.empty}</div>)}
    </section>
  );
}

export default function ReportsPage() {
  const [kind, setKind] = useState<"morning_brief" | "market_wrap">("morning_brief");
  const { data, isLoading, mutate } = useSWR<{ reports: ReportRow[] }>(`/api/reports?kind=${kind}`);
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reports = data?.reports ?? [];
  const sel = reports.find((r) => r.id === selId) ?? reports[0];
  const refs = Object.fromEntries((sel?.content.sources ?? []).map((s) => [s.ref, { url: s.url, title: `${s.source} — ${s.title}` }]));

  const regen = async () => {
    setBusy(true); setErr(null);
    try { await postJson("/api/reports", { kind }); await mutate(); setSelId(null); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={kind === "morning_brief"} onClick={() => { setKind("morning_brief"); setSelId(null); }}>Morning Brief · 07:30</Chip>
        <Chip active={kind === "market_wrap"} onClick={() => { setKind("market_wrap"); setSelId(null); }}>Market Wrap · 22:30</Chip>
        <Button size="xs" className="ml-auto" onClick={regen} disabled={busy}>{busy ? <><Spinner /> Generating (≈1 min)…</> : <><RefreshCw size={12} /> Generate now</>}</Button>
      </div>
      {err && <div className="text-xs text-down">{err}</div>}
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[200px_1fr]">
        <Panel title="History">
          {reports.map((r) => (
            <button key={r.id} onClick={() => setSelId(r.id)} className={cn("block w-full border-b border-line px-3 py-1.5 text-left text-xs hover:bg-panel-2", sel?.id === r.id && "bg-accent/10 text-accent")}>
              {formatParis(r.forDate + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })}
              <div className="text-[10px] text-dim">generated {fmtTime(r.generatedAt)}{!r.aiUsed && " · no AI"}</div>
            </button>
          ))}
          {!reports.length && !isLoading && <Empty>No reports. The worker generates them automatically at 07:30 and 22:30.</Empty>}
        </Panel>
        <Panel title={sel?.content.title ?? "Report"} subtitle={sel ? `generated on ${fmtDateTime(sel.generatedAt)} from the data available at that time` : undefined}>
          {isLoading ? <Empty><Spinner /></Empty> : !sel ? <Empty>—</Empty> : (
            <div className="space-y-2 p-2">
              {sel.content.aiError && <div className="rounded border border-accent/40 bg-accent/5 px-2 py-1 text-[11px] text-accent">AI summary unavailable ({sel.content.aiError}) — factual report only.</div>}
              <div className="grid gap-2 xl:grid-cols-2">{sel.content.sections.map((s, i) => <div key={i} className={s.type === "markdown" ? "xl:col-span-2" : ""}><SectionView s={s} refs={refs} /></div>)}</div>
              {!!sel.content.sources.length && (
                <section className="rounded border border-line p-3">
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-dim">Sources cited by the summary</h3>
                  {sel.content.sources.map((s) => <div key={s.ref} className="truncate text-[11px]"><span className="num text-dim">[{s.ref}]</span> {s.url ? <a className="text-info" href={s.url} target="_blank" rel="noreferrer">{s.source} — {s.title}</a> : `${s.source} — ${s.title}`} <span className="text-dim">· {fmtDateTime(s.date)}</span></div>)}
                </section>
              )}
              <Badge tone="muted">Quotes are delayed or closing prices depending on the market — timestamps shown.</Badge>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
