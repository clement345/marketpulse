"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJson, useQuotes } from "@/components/live";
import { Change, FreshnessBadge, MarketDot, Price, quoteTimeLabel, Sparkline } from "@/components/market";
import { NewsFeed } from "@/components/news";
import { EventsTable, useNow, type EventDTO } from "@/components/events";
import { Button, Chip, Empty, Input, Panel, Spinner } from "@/components/ui";

interface WL { id: string; name: string; items: { id: string; symbol: string; name: string | null }[] }

function SymbolSearch({ onPick }: { onPick: (s: string) => void }) {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const { data, isLoading } = useSWR<{ results: { symbol: string; name: string; type: string; exchange: string }[] }>(deb.length >= 1 ? `/api/search?q=${encodeURIComponent(deb)}` : null);
  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add: ticker or name (e.g. AAPL, LVMH, ^FTSE)…" className="w-72"
        onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { onPick(q.trim()); setQ(""); } }} />
      {deb && (
        <div className="absolute left-0 top-8 z-30 w-96 rounded border border-line-2 bg-panel-2 shadow-xl">
          {isLoading ? <div className="p-2"><Spinner /></div> : (data?.results ?? []).map((r) => (
            <button key={r.symbol} onClick={() => { onPick(r.symbol); setQ(""); setDeb(""); }} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-panel">
              <span><strong>{r.symbol}</strong> <span className="text-muted">{r.name}</span></span>
              <span className="text-[10px] text-dim">{r.type} · {r.exchange}</span>
            </button>
          ))}
          {!isLoading && !data?.results.length && <div className="p-2 text-xs text-dim">No results.</div>}
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  const { data, mutate } = useSWR<{ watchlists: WL[] }>("/api/watchlists");
  const { map, isLoading } = useQuotes();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const now = useNow(30_000);
  const lists = data?.watchlists ?? [];
  const active = lists.find((l) => l.id === activeId) ?? lists[0];
  const symbols = useMemo(() => active?.items.map((i) => i.symbol) ?? [], [active]);

  const from = useMemo(() => new Date(Date.now() - 3 * 86400_000).toISOString(), []);
  const to = useMemo(() => new Date(Date.now() + 14 * 86400_000).toISOString(), []);
  const { data: cal } = useSWR<{ events: EventDTO[] }>(symbols.length ? `/api/calendar?from=${from}&to=${to}&kind=earnings` : null);
  const corpEvents = (cal?.events ?? []).filter((e) => e.ticker && symbols.includes(e.ticker));

  const add = async (s: string) => {
    if (!active) return;
    setErr(null);
    try { await postJson(`/api/watchlists/${active.id}/items`, { symbol: s }); await mutate(); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (s: string) => { await postJson(`/api/watchlists/${active!.id}/items?symbol=${encodeURIComponent(s)}`, undefined, "DELETE"); mutate(); };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {lists.map((l) => <Chip key={l.id} active={active?.id === l.id} onClick={() => setActiveId(l.id)}>{l.name} <span className="text-dim">({l.items.length})</span></Chip>)}
        <form onSubmit={async (e) => { e.preventDefault(); if (!newName.trim()) return; const r = await postJson<{ watchlist: WL }>("/api/watchlists", { name: newName }); setNewName(""); await mutate(); setActiveId(r.watchlist.id); }} className="flex items-center gap-1">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list" className="w-32" />
          <Button size="xs" type="submit"><Plus size={12} /></Button>
        </form>
        {active && lists.length > 1 && (
          <Button size="xs" variant="ghost" onClick={async () => { if (confirm(`Delete the list “${active.name}”?`)) { await postJson(`/api/watchlists/${active.id}`, undefined, "DELETE"); setActiveId(null); mutate(); } }}><Trash2 size={12} /> Delete list</Button>
        )}
        <div className="ml-auto"><SymbolSearch onPick={add} /></div>
      </div>
      {err && <div className="rounded border border-down/40 bg-down/10 px-2 py-1 text-xs text-down">{err}</div>}
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={active?.name ?? "Watchlist"} subtitle="click a row for the chart">
          {isLoading ? <Empty><Spinner /></Empty> : !active?.items.length ? <Empty>Empty list. Add an asset using the search.</Empty> : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-panel"><tr className="border-b border-line text-[10px] uppercase tracking-wide text-dim">
                <th className="px-2 py-1 text-left font-medium">Asset</th><th className="px-2 py-1 text-right font-medium">Last</th><th className="px-2 py-1 text-right font-medium">Chg.</th>
                <th className="hidden px-2 py-1 font-medium md:table-cell">Session</th><th className="px-2 py-1 text-right font-medium">Time</th><th className="px-2 py-1 text-right font-medium">Status</th><th />
              </tr></thead>
              <tbody>
                {active.items.map((it) => {
                  const q = map.get(it.symbol);
                  return (
                    <tr key={it.id} className="border-b border-line hover:bg-panel-2/60">
                      <td className="px-2 py-1.5"><Link href={`/asset/${encodeURIComponent(it.symbol)}`} className="flex items-center gap-1.5 hover:text-accent">{q && <MarketDot state={q.market.state} />}<strong>{it.symbol}</strong><span className="hidden truncate text-[11px] text-dim sm:inline">{q?.name ?? it.name}</span></Link></td>
                      {q ? (<>
                        <td className="px-2 py-1.5 text-right"><Price q={q} /> <span className="text-[10px] text-dim">{q.currency}</span></td>
                        <td className="px-2 py-1.5 text-right"><Change q={q} mode="both" /></td>
                        <td className="hidden px-2 py-1.5 md:table-cell"><Sparkline data={q.sparkline} prevClose={q.prevClose} width={80} height={20} className="mx-auto" /></td>
                        <td className="num px-2 py-1.5 text-right text-[11px] text-dim">{quoteTimeLabel(q)}</td>
                        <td className="px-2 py-1.5 text-right"><FreshnessBadge q={q} /></td>
                      </>) : <td colSpan={5} className="px-2 py-1.5 text-center text-[11px] text-dim">Quote pending the worker's next cycle</td>}
                      <td className="px-1"><button onClick={() => remove(it.symbol)} className="text-dim hover:text-down" title="Remove"><X size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <div className="grid min-h-0 gap-2 lg:grid-rows-[1fr_auto]">
          <Panel title="Related news" subtitle="72 h">
            {symbols.length ? <NewsFeed query={`asset=${encodeURIComponent(symbols.join(","))}&limit=50`} compact empty="No recent news linked to these assets." /> : <Empty>—</Empty>}
          </Panel>
          <Panel title="Corporate events" subtitle="earnings D-3 → D+14" className={cn("max-h-72")}>
            {corpEvents.length ? <EventsTable events={corpEvents} now={now} showDate /> : <Empty>No known earnings releases for these securities (coverage: US companies via Nasdaq).</Empty>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
