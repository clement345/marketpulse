"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { LayoutGrid, RefreshCw, Settings2, Table2 } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { ASSET_CLASS_LABEL, CROSS_ASSET, INDICES } from "@/lib/instruments";
import type { QuoteView } from "@/lib/views";
import { postJson, useQuotes } from "./live";
import { Change, FreshnessBadge, MarketDot, Price, quoteTimeLabel, Sparkline, useFlash } from "./market";
import { Button, Chip, Empty, Panel, Spinner } from "./ui";
import { EventsTable, useNow, type EventDTO } from "./events";
import { NewsFeed } from "./news";

function IndexTile({ q, name }: { q?: QuoteView; name: string }) {
  const flash = useFlash(q?.price);
  if (!q) return <div className="rounded border border-line bg-panel-2/40 p-2 text-xs text-dim">{name}<div className="mt-2">Data unavailable</div></div>;
  return (
    <Link href={`/asset/${encodeURIComponent(q.symbol)}`} className={cn("group block rounded border border-line bg-panel-2/40 p-2 transition-colors hover:border-line-2", flash)}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-semibold">{q.name}</span>
        <span className="flex items-center gap-1 text-[10px] text-dim" title={q.market.label}><MarketDot state={q.market.state} />{q.market.label.replace(" (week-end)", "")}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <Price q={q} className="text-base font-semibold" />
          <div className="flex gap-2 text-[11px]"><Change q={q} mode="abs" /><Change q={q} /></div>
        </div>
        <Sparkline data={q.sparkline} prevClose={q.prevClose} width={84} height={30} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-dim">
        <span className="num" title="Time of last quote (Paris)">{quoteTimeLabel(q)}</span>
        <FreshnessBadge q={q} />
      </div>
    </Link>
  );
}

export function MarketOverview() {
  const { map, isLoading } = useQuotes();
  if (isLoading) return <Empty><Spinner /></Empty>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 p-2">
      {INDICES.map((i) => <IndexTile key={i.symbol} q={map.get(i.symbol)} name={i.name} />)}
    </div>
  );
}

const CLASSES = ["all", "fx", "crypto", "commodity", "volatility", "rate", "index", "equity"] as const;

function heatColor(v: number | null, scale: number) {
  if (v === null) return "rgb(46 51 64 / 0.5)";
  const a = Math.min(1, Math.abs(v) / scale);
  return v >= 0 ? `rgb(34 197 94 / ${0.12 + a * 0.6})` : `rgb(239 68 68 / ${0.12 + a * 0.6})`;
}

export function Heatmap({ quotes }: { quotes: QuoteView[] }) {
  const groups = useMemo(() => {
    const g = new Map<string, QuoteView[]>();
    for (const q of quotes) g.set(q.assetClass, [...(g.get(q.assetClass) ?? []), q]);
    return [...g.entries()];
  }, [quotes]);
  return (
    <div className="space-y-2 p-2">
      {groups.map(([cls, qs]) => (
        <div key={cls}>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-dim">{ASSET_CLASS_LABEL[cls] ?? cls}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1">
            {qs.map((q) => {
              const v = q.changeBp !== null ? q.changeBp / 10 : q.changePct; // 10 bp ≈ 1% for the color scale
              return (
                <Link key={q.symbol} href={`/asset/${encodeURIComponent(q.symbol)}`} style={{ background: heatColor(v, cls === "crypto" ? 6 : 2.5) }} className="rounded px-1.5 py-1.5 text-center hover:ring-1 hover:ring-fg/40" title={`${q.name} — ${quoteTimeLabel(q)}`}>
                  <div className="truncate text-[11px] font-semibold">{q.short}</div>
                  <Change q={q} className="text-[11px] !text-fg" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CrossAssetMonitor({ extraSymbols = [] }: { extraSymbols?: string[] }) {
  const { quotes, isLoading } = useQuotes();
  const [cls, setCls] = useState<(typeof CLASSES)[number]>("all");
  const [view, setView] = useState<"table" | "heatmap">("table");
  const base = new Set([...CROSS_ASSET.map((c) => c.symbol), ...extraSymbols]);
  const all = quotes.filter((q) => base.has(q.symbol) || (view === "heatmap"));
  const shown = all.filter((q) => cls === "all" || q.assetClass === cls);
  const order = [...CROSS_ASSET.map((c) => c.symbol)];
  shown.sort((a, b) => (order.indexOf(a.symbol) + 1 || 999) - (order.indexOf(b.symbol) + 1 || 999));
  return (
    <Panel
      title="Cross-Asset Monitor"
      actions={
        <>
          <Button variant="ghost" size="xs" onClick={() => setView("table")} className={cn(view === "table" && "text-accent")} title="Table"><Table2 size={13} /></Button>
          <Button variant="ghost" size="xs" onClick={() => setView("heatmap")} className={cn(view === "heatmap" && "text-accent")} title="Heatmap"><LayoutGrid size={13} /></Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        {CLASSES.map((c) => <Chip key={c} active={cls === c} onClick={() => setCls(c)}>{c === "all" ? "All" : ASSET_CLASS_LABEL[c]}</Chip>)}
      </div>
      {isLoading ? <Empty><Spinner /></Empty> : view === "heatmap" ? <Heatmap quotes={shown} /> : (
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr className="border-b border-line text-[10px] uppercase tracking-wide text-dim">
              <th className="px-2 py-1 text-left font-medium">Asset</th>
              <th className="px-2 py-1 text-right font-medium">Last</th>
              <th className="px-2 py-1 text-right font-medium">Chg.</th>
              <th className="hidden px-2 py-1 font-medium sm:table-cell">Session</th>
              <th className="px-2 py-1 text-right font-medium">Time</th>
              <th className="px-2 py-1 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((q) => <CrossRow key={q.symbol} q={q} />)}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function CrossRow({ q }: { q: QuoteView }) {
  const flash = useFlash(q.price);
  return (
    <tr className={cn("border-b border-line hover:bg-panel-2/60", flash)}>
      <td className="px-2 py-1">
        <Link href={`/asset/${encodeURIComponent(q.symbol)}`} className="flex items-center gap-1.5 hover:text-accent">
          <MarketDot state={q.market.state} />
          <span className="font-medium">{q.short}</span>
          <span className="hidden truncate text-[11px] text-dim lg:inline">{q.name}</span>
        </Link>
      </td>
      <td className="px-2 py-1 text-right"><Price q={q} /></td>
      <td className="px-2 py-1 text-right"><Change q={q} /></td>
      <td className="hidden px-2 py-1 sm:table-cell"><Sparkline data={q.sparkline} prevClose={q.assetClass === "rate" ? null : q.prevClose} width={70} height={18} className="mx-auto" /></td>
      <td className="num px-2 py-1 text-right text-[11px] text-dim">{quoteTimeLabel(q)}</td>
      <td className="px-2 py-1 text-right"><FreshnessBadge q={q} /></td>
    </tr>
  );
}

export function UpcomingEvents() {
  const now = useNow();
  const from = useMemo(() => new Date(Date.now() - 6 * 3600_000).toISOString(), []);
  const to = useMemo(() => new Date(Date.now() + 3 * 86400_000).toISOString(), []);
  const { data, isLoading } = useSWR<{ events: EventDTO[] }>(`/api/calendar?from=${from}&to=${to}&minImportance=2`, { refreshInterval: 300_000 });
  if (isLoading) return <Empty><Spinner /></Empty>;
  if (!data?.events.length) return <Empty>No medium/high-importance events in the 72 h covered by the sources.</Empty>;
  return <EventsTable events={data.events} now={now} showDate compact />;
}

export function CorrelationMatrix() {
  const { data, error, isLoading } = useSWR<{ symbols: string[]; matrix: (number | null)[][]; window: string; note: string; computedAt: string }>("/api/correlations", { revalidateOnFocus: false });
  if (isLoading) return <Empty><Spinner /> <span className="ml-2">Computing correlations…</span></Empty>;
  if (error || !data) return <Empty>Correlations unavailable ({error?.message}).</Empty>;
  const lbl = (s: string) => [...INDICES, ...CROSS_ASSET].find((i) => i.symbol === s)?.short ?? (s === "^TNX" ? "US10Y" : s);
  return (
    <div className="p-2">
      <div className="overflow-auto">
        <table className="border-collapse text-[10px]">
          <thead><tr><th />{data.symbols.map((s) => <th key={s} className="px-1 py-0.5 font-medium text-dim">{lbl(s)}</th>)}</tr></thead>
          <tbody>
            {data.symbols.map((a, i) => (
              <tr key={a}>
                <th className="pr-1 text-right font-medium text-dim">{lbl(a)}</th>
                {data.matrix[i].map((v, j) => (
                  <td key={j} className="num h-6 w-10 text-center" style={{ background: v === null ? "transparent" : v >= 0 ? `rgb(56 189 248 / ${Math.abs(v) * 0.7})` : `rgb(245 158 11 / ${Math.abs(v) * 0.7})` }} title={`${lbl(a)} / ${lbl(data.symbols[j])}`}>
                    {v === null ? "—" : fmtNum(v, 2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-dim">{data.window}. {data.note}</p>
    </div>
  );
}

/** Customization: visible panels (local preference). */
const PANELS = { overview: "Market Overview", cross: "Cross-Asset", breaking: "Breaking News", events: "72h Agenda", correl: "Correlations" } as const;
export type PanelKey = keyof typeof PANELS;

export function usePanelPrefs() {
  const [prefs, setPrefs] = useState<Record<PanelKey, boolean>>({ overview: true, cross: true, breaking: true, events: true, correl: false });
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("mp:panels") || "{}"); setPrefs((p) => ({ ...p, ...saved })); } catch { /* storage unavailable */ }
  }, []);
  const toggle = (k: PanelKey) => setPrefs((p) => { const n = { ...p, [k]: !p[k] }; try { localStorage.setItem("mp:panels", JSON.stringify(n)); } catch {} return n; });
  return { prefs, toggle };
}

export function PanelMenu({ prefs, toggle }: ReturnType<typeof usePanelPrefs>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <Button variant="ghost" size="xs" disabled={busy} title="Refresh quotes now" onClick={async () => { setBusy(true); try { await postJson("/api/refresh"); } finally { setBusy(false); } }}>
        <RefreshCw size={13} className={cn(busy && "animate-spin")} />
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setOpen((o) => !o)}><Settings2 size={13} /> Panels</Button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-48 rounded border border-line-2 bg-panel-2 p-1 shadow-xl">
          {(Object.keys(PANELS) as PanelKey[]).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-panel">
              <input type="checkbox" checked={prefs[k]} onChange={() => toggle(k)} className="accent-amber-500" />{PANELS[k]}
            </label>
          ))}
          <div className="px-2 pt-1 text-[10px] text-dim">Dividers are resizable; the layout is remembered.</div>
        </div>
      )}
    </div>
  );
}

export { NewsFeed };
