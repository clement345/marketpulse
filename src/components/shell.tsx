"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { Activity, Bell, Bot, CalendarDays, FileText, LayoutDashboard, Newspaper, Settings2, Star, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICES, CROSS_ASSET } from "@/lib/instruments";
import { useLive, useQuotes } from "./live";
import { Change, Price } from "./market";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/chat", label: "AI Analyst", icon: Bot },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/alerts", label: "Alerts", icon: Zap },
  { href: "/status", label: "Sources", icon: Activity },
];

const CLOCKS = [
  { label: "PAR", tz: "Europe/Paris" }, { label: "LDN", tz: "Europe/London" },
  { label: "NY", tz: "America/New_York" }, { label: "TKY", tz: "Asia/Tokyo" },
];

function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  if (!now) return null;
  return (
    <div className="hidden items-center gap-3 lg:flex">
      {CLOCKS.map((c) => (
        <div key={c.tz} className="flex items-baseline gap-1">
          <span className="text-[10px] text-dim">{c.label}</span>
          <span className="num text-[11px] text-muted">{new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: c.label === "PAR" ? "2-digit" : undefined }).format(now)}</span>
        </div>
      ))}
    </div>
  );
}

function TickerTape() {
  const { map } = useQuotes();
  const items = [...INDICES, ...CROSS_ASSET].map((i) => map.get(i.symbol)).filter(Boolean);
  if (!items.length) return <div className="flex-1" />;
  const row = items.map((q) => (
    <Link key={q!.symbol} href={`/asset/${encodeURIComponent(q!.symbol)}`} className="flex items-baseline gap-1.5 px-3 hover:bg-panel-2">
      <span className="text-[11px] font-medium text-muted">{q!.short}</span>
      <Price q={q!} className="text-[11px]" />
      <Change q={q!} className="text-[11px]" />
    </Link>
  ));
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div className="ticker-track flex w-max">{row}{row}</div>
    </div>
  );
}

function Bellicon() {
  const { data } = useSWR<{ unread: number }>("/api/notifications", { refreshInterval: 60_000 });
  return (
    <Link href="/alerts" className="relative rounded p-1 text-muted hover:text-fg" title="Notifications">
      <Bell size={15} />
      {!!data?.unread && <span className="num absolute -right-1 -top-1 rounded-full bg-down px-1 text-[9px] text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
    </Link>
  );
}

function Toasts() {
  const { toasts, dismiss } = useLive();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={cn("pointer-events-auto rounded-md border bg-panel-2 p-3 shadow-2xl", t.priority >= 3 ? "border-down/60" : "border-accent/50")}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-semibold">{t.title}</div>
            <button onClick={() => dismiss(t.id)} className="text-dim hover:text-fg"><X size={13} /></button>
          </div>
          <div className="mt-1 text-[11px] text-muted">{t.body}</div>
          {t.url && <a href={t.url} target={t.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="mt-1 inline-block text-[11px] text-info">Open →</a>}
        </div>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { connected } = useLive();
  if (path === "/login") return <>{children}</>;
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <Link href="/" className="flex items-center gap-1.5 pr-2">
          <span className="h-2 w-2 rotate-45 bg-accent" />
          <span className="text-xs font-bold tracking-[0.2em]">MARKETPULSE</span>
        </Link>
        <TickerTape />
        <Clocks />
        <span className={cn("flex items-center gap-1 text-[10px]", connected ? "text-up" : "text-down")} title={connected ? "Real-time stream connected (SSE)" : "Stream disconnected — reconnecting…"}>
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-up" : "bg-down")} />{connected ? "LIVE" : "OFF"}
        </span>
        <Bellicon />
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-line bg-panel p-2 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-xs", active ? "bg-accent/10 text-accent" : "text-muted hover:bg-panel-2 hover:text-fg")}>
                <Icon size={14} />{label}
              </Link>
            );
          })}
          <div className="mt-auto px-2 pb-1 text-[10px] leading-relaxed text-dim">
            <Settings2 size={11} className="mb-1 inline" /> Delayed data unless marked "Real-time". Not investment advice.
          </div>
        </nav>
        <main className="min-w-0 flex-1 overflow-auto pb-14 md:pb-0">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-panel py-1 md:hidden">
        {NAV.slice(0, 6).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 px-2 py-1 text-[9px]", active ? "text-accent" : "text-muted")}>
              <Icon size={16} />{label}
            </Link>
          );
        })}
      </nav>
      <Toasts />
    </div>
  );
}
