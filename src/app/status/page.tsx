"use client";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { fmtDateTime, relativeAge } from "@/lib/time";
import { Badge, Panel } from "@/components/ui";

interface P { id: string; lastSuccess: string | null; lastError: string | null; errorMsg: string | null; okCount: number; errorCount: number }

const CATALOG: [string, string, string, string][] = [
  ["Indices, FX, commodities, VIX, stocks", "Yahoo Finance (public chart endpoint)", "Free, no key, unofficial; delayed (≈15-20 min depending on exchange); personal use", "Opérationnel"],
  ["Bitcoin, Ethereum", "Binance public API (fallback: Yahoo)", "Free, real-time, no key", "Opérationnel"],
  ["US 2Y / 10Y yields", "U.S. Treasury — Daily Par Yield Curve", "Official, public domain, daily (end of NY day)", "Opérationnel"],
  ["Eurozone 2Y / 10Y yields", "ECB Data Portal — AAA curve", "Official, free, daily D+1; ≠ continuously quoted Bund", "Opérationnel"],
  ["News", "RSS Bloomberg, FT, CNBC, MarketWatch, Investing.com, Yahoo, Fed, ECB", "Publishers' public feeds: title + summary + link, no paywall circumvention", "Opérationnel"],
  ["Reuters news", "—", "Reuters no longer has a public RSS feed; paid API (Refinitiv/LSEG)", "Non disponible"],
  ["SEC filings (8-K)", "SEC EDGAR (Atom per company)", "Free; requires SEC_USER_AGENT with a contact email", "Requiert configuration"],
  ["Macro calendar", "Forex Factory (public JSON export)", "Current week only; consensus + previous, no actual value", "Opérationnel"],
  ["US actual values", "BLS Public API v1", "Official, free, 25 req/day without key (v2 with free key: 500/day)", "Opérationnel"],
  ["Non-US actual values", "—", "No reliable free source (Trading Economics / Bloomberg are paid)", "Non disponible"],
  ["Fed / ECB meetings", "Official calendars federalreserve.gov / ecb.europa.eu", "Official, free", "Opérationnel"],
  ["Corporate earnings", "api.nasdaq.com (earnings calendar)", "Free, undocumented; US-listed companies", "Opérationnel"],
  ["AI (analyses, chat, reports)", "Claude Code headless (`claude -p`)", "Covered by the existing Claude subscription, no pay-per-use cost; subscription quota", "Opérationnel"],
  ["Telegram / email notifications", "Telegram bot / SMTP", "Free; tokens to be set in .env", "Requiert configuration"],
];

export default function StatusPage() {
  const { data } = useSWR<{ providers: P[]; counts: Record<string, number>; lastNewsFetch: string | null; config: Record<string, string | boolean> }>("/api/status", { refreshInterval: 30_000 });
  return (
    <div className="grid gap-2 p-2 xl:grid-cols-2">
      <Panel title="Source health" subtitle="updated by the worker">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-line text-[10px] uppercase text-dim"><th className="px-2 py-1 text-left font-medium">Source</th><th className="px-2 py-1 font-medium">Status</th><th className="px-2 py-1 text-right font-medium">Last success</th><th className="px-2 py-1 text-right font-medium">OK / errors</th></tr></thead>
          <tbody>
            {(data?.providers ?? []).map((p) => {
              const ok = p.lastSuccess && (!p.lastError || new Date(p.lastSuccess) > new Date(p.lastError));
              return (
                <tr key={p.id} className="border-b border-line" title={p.errorMsg ?? ""}>
                  <td className="px-2 py-1 font-medium">{p.id}</td>
                  <td className="px-2 py-1 text-center"><Badge tone={ok ? "up" : "down"}>{ok ? "OK" : "Error"}</Badge></td>
                  <td className="num px-2 py-1 text-right text-[11px] text-muted">{p.lastSuccess ? `${fmtDateTime(p.lastSuccess)} (${relativeAge(p.lastSuccess)})` : "never"}</td>
                  <td className={cn("num px-2 py-1 text-right text-[11px]", p.errorCount ? "text-accent" : "text-dim")}>{p.okCount} / {p.errorCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!!data?.providers.some((p) => p.errorMsg) && (
          <div className="border-t border-line p-2 text-[11px] text-dim">
            <div className="mb-1 font-semibold uppercase">Latest errors</div>
            {data!.providers.filter((p) => p.errorMsg).map((p) => <div key={p.id} className="truncate"><span className="text-muted">{p.id}</span> — {p.errorMsg}</div>)}
          </div>
        )}
      </Panel>
      <div className="space-y-2">
        <Panel title="Database" bodyClassName="p-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {Object.entries(data?.counts ?? {}).map(([k, v]) => <div key={k}><div className="text-[10px] uppercase text-dim">{k}</div><div className="num text-base">{v}</div></div>)}
          <div className="col-span-full text-[11px] text-dim">Configuration: AI {String(data?.config.ai)} · SEC {data?.config.sec ? "enabled" : "disabled"} · Telegram {data?.config.telegram ? "yes" : "no"} · Email {data?.config.email ? "yes" : "no"} · Password {data?.config.auth ? "enabled" : "disabled"}</div>
        </Panel>
        <Panel title="Provider catalog">
          <table className="w-full text-xs">
            <tbody>
              {CATALOG.map(([what, who, lic, st]) => (
                <tr key={what} className="border-b border-line align-top">
                  <td className="px-2 py-1.5 font-medium">{what}</td>
                  <td className="px-2 py-1.5"><div>{who}</div><div className="text-[11px] text-dim">{lic}</div></td>
                  <td className="px-2 py-1.5 text-right"><Badge tone={st === "Opérationnel" ? "up" : st === "Non disponible" ? "down" : "accent"}>{st}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
