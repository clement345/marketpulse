"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatParis, PARIS, zonedDateKey, zonedTimeToUtc } from "@/lib/time";
import { EventsTable, FLAG, ImpactDots, KIND_LABEL, useNow, type EventDTO } from "@/components/events";
import { Badge, Button, Chip, Empty, Panel, Select, Spinner } from "@/components/ui";

type View = "day" | "week" | "month";
const COUNTRIES = ["USD", "EUR", "GBP", "JPY", "CNY", "CHF", "CAD", "AUD"];

function parisMidnight(d: Date) {
  const [y, m, dd] = zonedDateKey(d, PARIS).split("-").map(Number);
  return zonedTimeToUtc(y, m, dd, 0, 0, PARIS);
}
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400_000); }

function range(view: View, anchor: Date): [Date, Date] {
  const start = parisMidnight(anchor);
  if (view === "day") return [start, addDays(start, 1)];
  if (view === "week") {
    const wd = (new Date(zonedDateKey(anchor, PARIS) + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
    const s = parisMidnight(addDays(start, -wd));
    return [s, parisMidnight(addDays(s, 7.2))];
  }
  const [y, m] = zonedDateKey(anchor, PARIS).split("-").map(Number);
  return [zonedTimeToUtc(y, m, 1, 0, 0, PARIS), zonedTimeToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, 0, 0, PARIS)];
}

export default function CalendarPage() {
  const now = useNow();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [countries, setCountries] = useState<string[]>([]);
  const [minImp, setMinImp] = useState(1);
  const [kinds, setKinds] = useState<string[]>([]);
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [from, to] = useMemo(() => range(view, anchor), [view, anchor]);

  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), minImportance: String(minImp) });
  if (countries.length) qs.set("country", countries.join(","));
  if (kinds.length) qs.set("kind", kinds.join(","));
  const { data, isLoading } = useSWR<{ events: EventDTO[]; macroCoverage: { from: string | null; to: string | null } }>(`/api/calendar?${qs}`, { refreshInterval: 120_000 });

  const step = (dir: number) => setAnchor((a) => view === "day" ? addDays(a, dir) : view === "week" ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 15));
  const byDay = useMemo(() => {
    const m = new Map<string, EventDTO[]>();
    for (const e of data?.events ?? []) { const k = zonedDateKey(new Date(e.scheduledAt), PARIS); m.set(k, [...(m.get(k) ?? []), e]); }
    return m;
  }, [data]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const askNotif = async () => { if (typeof Notification !== "undefined") await Notification.requestPermission(); };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {(["day", "week", "month"] as View[]).map((v) => <Chip key={v} active={view === v} onClick={() => setView(v)}>{{ day: "Day", week: "Week", month: "Month" }[v]}</Chip>)}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => step(-1)}><ChevronLeft size={14} /></Button>
          <Button size="xs" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="ghost" size="xs" onClick={() => step(1)}><ChevronRight size={14} /></Button>
        </div>
        <span className="text-xs font-medium text-muted">{formatParis(from, { day: "numeric", month: "long" })} → {formatParis(addDays(to, -0.5), { day: "numeric", month: "long", year: "numeric" })}</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={minImp} onChange={(e) => setMinImp(Number(e.target.value))}><option value={1}>All importance levels</option><option value={2}>Medium and high</option><option value={3}>High only</option></Select>
          <Button size="xs" variant="ghost" onClick={askNotif} title="Allow browser notifications (configured in Alerts)"><Bell size={12} /> Notifications</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {COUNTRIES.map((c) => <Chip key={c} active={countries.includes(c)} onClick={() => toggle(countries, c, setCountries)}>{FLAG[c]} {c}</Chip>)}
        <span className="mx-1 w-px bg-line" />
        {Object.entries(KIND_LABEL).map(([k, v]) => <Chip key={k} active={kinds.includes(k)} onClick={() => toggle(kinds, k, setKinds)}>{v}</Chip>)}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <Panel title="Economic calendar" subtitle="Europe/Paris time" className="min-h-[400px] flex-1">
          {isLoading ? <Empty><Spinner /></Empty> : !data?.events.length ? <Empty>No events in this period in the available sources.</Empty> : view === "month" ? (
            <MonthGrid from={from} byDay={byDay} onPick={(d) => { setAnchor(d); setView("day"); }} />
          ) : (
            <div>
              {[...byDay.entries()].map(([day, evs]) => (
                <div key={day}>
                  <div className={cn("sticky top-0 z-20 border-b border-line bg-panel-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide", day === zonedDateKey(new Date(), PARIS) ? "text-accent" : "text-muted")}>
                    {formatParis(new Date(day + "T12:00:00Z"), { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  <EventsTable events={evs} now={now} onSelect={setSelected} />
                </div>
              ))}
            </div>
          )}
        </Panel>
        <div className="flex w-full flex-col gap-2 lg:w-80">
          {selected ? <EventDetail e={selected} onClose={() => setSelected(null)} /> : <Panel title="Details"><Empty>Click an event to see its details and history.</Empty></Panel>}
          <Panel title="Source coverage" className="shrink-0" bodyClassName="p-2 text-[11px] leading-relaxed text-muted">
            <p><strong className="text-fg">Macro</strong>: Forex Factory (current week only) — consensus and previous.{data?.macroCoverage.to && <> Data collected through {formatParis(data.macroCoverage.to, { day: "numeric", month: "short" })}.</>}</p>
            <p className="mt-1"><strong className="text-fg">Actual values</strong>: US (CPI, Core CPI, NFP, unemployment, wages, PPI) via the official BLS API. Other countries: not available for free → "n/a".</p>
            <p className="mt-1"><strong className="text-fg">Central banks</strong>: official Fed and ECB calendars (upcoming months included).</p>
            <p className="mt-1"><strong className="text-fg">Earnings</strong>: Nasdaq (market cap &gt; $30B + watchlist), D-3 to D+10.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ from, byDay, onPick }: { from: Date; byDay: Map<string, EventDTO[]>; onPick: (d: Date) => void }) {
  const first = new Date(zonedDateKey(from, PARIS) + "T12:00:00Z");
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getTime() + (i - offset) * 86400_000));
  const month = first.getUTCMonth();
  const today = zonedDateKey(new Date(), PARIS);
  return (
    <div className="grid grid-cols-7 gap-px bg-line p-px">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-panel px-1 py-0.5 text-center text-[10px] text-dim">{d}</div>)}
      {days.map((d) => {
        const k = d.toISOString().slice(0, 10);
        const evs = (byDay.get(k) ?? []).filter((e) => e.importance >= 2).sort((a, b) => b.importance - a.importance);
        return (
          <button key={k} onClick={() => onPick(d)} className={cn("min-h-24 bg-panel p-1 text-left align-top hover:bg-panel-2", d.getUTCMonth() !== month && "opacity-40")}>
            <div className={cn("num text-[11px]", k === today ? "font-bold text-accent" : "text-muted")}>{d.getUTCDate()}</div>
            {evs.slice(0, 4).map((e) => (
              <div key={e.id} className="mt-0.5 flex items-center gap-1 truncate text-[10px]"><ImpactDots n={e.importance} /><span className="truncate">{FLAG[e.country]} {e.title}</span></div>
            ))}
            {evs.length > 4 && <div className="text-[10px] text-dim">+{evs.length - 4}</div>}
          </button>
        );
      })}
    </div>
  );
}

function EventDetail({ e, onClose }: { e: EventDTO; onClose: () => void }) {
  const qs = new URLSearchParams({ title: e.title, country: e.country, from: "2000-01-01", to: new Date(Date.now() + 365 * 86400_000).toISOString() });
  const { data } = useSWR<{ events: EventDTO[] }>(e.kind === "macro" ? `/api/calendar?${qs}` : null);
  const hist = (data?.events ?? []).filter((x) => x.id !== e.id).reverse();
  return (
    <Panel title="Details" actions={<button onClick={onClose} className="text-[11px] text-dim hover:text-fg">Close</button>} bodyClassName="p-3 text-xs space-y-2">
      <div className="text-sm font-semibold">{FLAG[e.country]} {e.title}</div>
      <div className="flex flex-wrap gap-1"><Badge>{KIND_LABEL[e.kind]}</Badge><Badge tone={e.importance === 3 ? "down" : "default"}>Importance {["", "low", "medium", "high"][e.importance]}</Badge></div>
      <div className="text-muted">{formatParis(e.scheduledAt, { dateStyle: "full", timeStyle: e.allDay ? undefined : "short" })} (Paris)</div>
      <div className="grid grid-cols-3 gap-2 rounded border border-line p-2 text-center">
        <div><div className="text-[10px] text-dim">Actual</div><div className="num font-semibold">{e.actual ?? "—"}</div></div>
        <div><div className="text-[10px] text-dim">Consensus</div><div className="num">{e.consensus ?? "—"}</div></div>
        <div><div className="text-[10px] text-dim">Previous</div><div className="num text-muted">{e.previous ?? "—"}</div></div>
      </div>
      {e.actualSource && <div className="text-[11px] text-dim">Actual value: source {e.actualSource === "bls" ? "Bureau of Labor Statistics (calculated from the published index)" : e.actualSource}</div>}
      {e.sourceUrl && <a className="block text-[11px] text-info" href={e.sourceUrl} target="_blank" rel="noreferrer">Source ({e.source}) →</a>}
      {e.kind === "macro" && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Collected history</div>
          {hist.length ? (
            <table className="w-full text-[11px]">
              <tbody>{hist.map((h) => <tr key={h.id} className="border-b border-line"><td className="py-0.5 text-dim">{formatParis(h.scheduledAt, { day: "2-digit", month: "short", year: "2-digit" })}</td><td className="num text-right">{h.actual ?? "—"}</td><td className="num text-right text-muted">{h.consensus ?? "—"}</td></tr>)}</tbody>
            </table>
          ) : <div className="text-[11px] text-dim">History builds up over the weeks of data collection.</div>}
        </div>
      )}
    </Panel>
  );
}
