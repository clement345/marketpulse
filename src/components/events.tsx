"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtTime, formatParis } from "@/lib/time";
import { Badge } from "./ui";

export interface EventDTO {
  id: string; kind: string; title: string; country: string; scheduledAt: string; allDay: boolean; importance: number;
  previous: string | null; consensus: string | null; actual: string | null; actualSource: string | null; surprise: number | null;
  ticker: string | null; source: string; sourceUrl: string | null;
}

export const FLAG: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CNY: "🇨🇳", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿", CHF: "🇨🇭", All: "🌐" };
export const KIND_LABEL: Record<string, string> = { macro: "Macro", central_bank: "Central bank", speech: "Speech", earnings: "Earnings" };

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(i); }, [intervalMs]);
  return now;
}

export function Countdown({ at, now }: { at: string; now: number | null }) {
  if (now === null) return null;
  const s = Math.round((new Date(at).getTime() - now) / 1000);
  if (s <= 0) return null;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const txt = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
  return <span className={cn("num text-[11px]", s < 900 ? "text-down" : s < 3600 ? "text-accent" : "text-dim")}>{txt}</span>;
}

export function ImpactDots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" title={["", "Low", "Medium", "High"][n] + " importance"}>
      {[1, 2, 3].map((i) => <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= n ? (n === 3 ? "bg-down" : n === 2 ? "bg-accent" : "bg-muted") : "bg-line-2")} />)}
    </span>
  );
}

/** Surprise: sign and magnitude relative to the gap between actual and consensus. */
export function SurpriseCell({ e }: { e: EventDTO }) {
  if (e.surprise === null) return <span className="text-dim">—</span>;
  const tone = e.surprise > 0 ? "text-up" : e.surprise < 0 ? "text-down" : "text-muted";
  const unit = e.kind === "earnings" ? " $" : e.actual?.trim().endsWith("%") ? " pt" : e.actual?.trim().endsWith("K") ? "K" : "";
  return <span className={cn("num font-semibold", tone)}>{e.surprise > 0 ? "+" : ""}{e.surprise}{unit}</span>;
}

export function EventRow({ e, now, onSelect, showDate, compact }: { e: EventDTO; now: number | null; onSelect?: (e: EventDTO) => void; showDate?: boolean; compact?: boolean }) {
  const past = now !== null && new Date(e.scheduledAt).getTime() <= now;
  const bigSurprise = e.surprise !== null && e.surprise !== 0 && e.kind !== "earnings";
  return (
    <tr onClick={() => onSelect?.(e)} className={cn("cursor-pointer border-b border-line hover:bg-panel-2/60", past && !e.actual && "opacity-70", bigSurprise && "bg-accent/5")}>
      <td className="num whitespace-nowrap px-2 py-1.5 text-[11px] text-muted">
        {showDate && <span className={cn("mr-1 text-dim", compact && "block")}>{formatParis(e.scheduledAt, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>}
        {e.allDay ? "All day" : fmtTime(e.scheduledAt)}
      </td>
      <td className="px-1 py-1.5 text-center" title={e.country}>{FLAG[e.country] ?? e.country}</td>
      <td className="px-1 py-1.5"><ImpactDots n={e.importance} /></td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs", compact && "line-clamp-1", e.importance === 3 ? "font-semibold text-fg" : "text-muted")} title={e.title}>{e.title}</span>
          {e.kind !== "macro" && !compact && <Badge tone={e.kind === "central_bank" ? "accent" : e.kind === "earnings" ? "info" : "default"}>{KIND_LABEL[e.kind]}</Badge>}
        </div>
      </td>
      <td className="num px-2 py-1.5 text-right text-xs">{e.actual ? <span className="font-semibold text-fg" title={`Source: ${e.actualSource}`}>{e.actual}</span> : past ? <span className="text-[10px] text-dim" title="Actual value not provided by the available free sources">n/a</span> : <Countdown at={e.scheduledAt} now={now} />}</td>
      <td className="num px-2 py-1.5 text-right text-xs text-muted">{e.consensus ?? "—"}</td>
      {!compact && <td className="num px-2 py-1.5 text-right text-xs text-dim">{e.previous ?? "—"}</td>}
      {!compact && <td className="px-2 py-1.5 text-right text-xs"><SurpriseCell e={e} /></td>}
    </tr>
  );
}

export function EventsTable({ events, now, onSelect, showDate, compact }: { events: EventDTO[]; now: number | null; onSelect?: (e: EventDTO) => void; showDate?: boolean; compact?: boolean }) {
  return (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-10 bg-panel">
        <tr className="border-b border-line text-[10px] uppercase tracking-wide text-dim">
          <th className="px-2 py-1 text-left font-medium">Time (Paris)</th>
          <th className="px-1 py-1 font-medium">Country</th>
          <th className="px-1 py-1 font-medium">Imp.</th>
          <th className="px-2 py-1 text-left font-medium">Event</th>
          <th className="px-2 py-1 text-right font-medium">Actual</th>
          <th className="px-2 py-1 text-right font-medium">Consensus</th>
          {!compact && <th className="px-2 py-1 text-right font-medium">Previous</th>}
          {!compact && <th className="px-2 py-1 text-right font-medium">Surprise</th>}
        </tr>
      </thead>
      <tbody>{events.map((e) => <EventRow key={e.id} e={e} now={now} onSelect={onSelect} showDate={showDate} compact={compact} />)}</tbody>
    </table>
  );
}
