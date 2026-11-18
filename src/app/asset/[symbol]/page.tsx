"use client";
import { use, useState } from "react";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { findInstrument } from "@/lib/instruments";
import { fmtDateTime } from "@/lib/time";
import { fmtNum } from "@/lib/utils";
import type { HistoryBar } from "@/lib/providers/types";
import { postJson, useQuotes } from "@/components/live";
import { Change, FreshnessBadge, MarketDot, Price } from "@/components/market";
import { PriceChart } from "@/components/chart";
import { NewsFeed } from "@/components/news";
import { Button, Chip, Empty, Input, Panel, Spinner } from "@/components/ui";

const RANGES = [["1d", "1D"], ["5d", "5D"], ["1mo", "1M"], ["6mo", "6M"], ["1y", "1Y"], ["5y", "5Y"]] as const;

export default function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = use(params);
  const symbol = decodeURIComponent(raw);
  const inst = findInstrument(symbol);
  const { map } = useQuotes();
  const q = map.get(symbol);
  const [range, setRange] = useState("6mo");
  const [mode, setMode] = useState<"candles" | "area">("candles");
  const { data, error, isLoading } = useSWR<{ bars: HistoryBar[]; source: string; note?: string; currency?: string }>(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);
  const [alertPx, setAlertPx] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const createAlert = async (type: "price_above" | "price_below") => {
    const t = parseFloat(alertPx.replace(",", "."));
    if (!Number.isFinite(t)) return setMsg("Invalid threshold");
    await postJson("/api/alerts", { name: `${inst?.short ?? symbol} ${type === "price_above" ? "≥" : "≤"} ${t}`, type, symbol, threshold: t, priority: 2, cooldownMin: 240, channels: ["inapp", "browser"] });
    setMsg("Alert created (manage it in Alerts)."); setAlertPx("");
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-md border border-line bg-panel px-3 py-2">
        <div>
          <div className="text-[11px] text-dim">{symbol}{q?.currency && q.currency !== "%" ? ` · ${q.currency}` : ""}</div>
          <h1 className="text-lg font-semibold">{q?.name ?? inst?.name ?? symbol}</h1>
        </div>
        {q ? (
          <>
            <div><Price q={q} className="text-2xl font-semibold" /> <Change q={q} mode="both" className="ml-2 text-sm" /></div>
            <div className="text-[11px] text-muted">
              <div className="flex items-center gap-1.5"><MarketDot state={q.market.state} />{q.market.label} <FreshnessBadge q={q} /></div>
              <div className="num">Quote: {fmtDateTime(q.quoteTime)} (Paris) · source {q.provider}</div>
            </div>
            {(q.dayHigh || q.dayLow) && <div className="num text-[11px] text-muted">Session: {fmtNum(q.dayLow, q.decimals)} – {fmtNum(q.dayHigh, q.decimals)}<br />Prev. close: {fmtNum(q.prevClose, q.decimals)}</div>}
          </>
        ) : <span className="text-xs text-dim">Quote not tracked by the worker (add the asset to a watchlist for continuous tracking).</span>}
        <div className="ml-auto flex items-center gap-1">
          <Input value={alertPx} onChange={(e) => setAlertPx(e.target.value)} placeholder="Price threshold" className="w-28" />
          <Button size="xs" onClick={() => createAlert("price_above")}><Bell size={11} /> ≥</Button>
          <Button size="xs" onClick={() => createAlert("price_below")}><Bell size={11} /> ≤</Button>
          {msg && <span className="text-[11px] text-muted">{msg}</span>}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[1fr_420px]">
        <Panel title="Chart" subtitle={data?.note ?? (data ? `source ${data.source} · Paris time` : undefined)}
          actions={<>{RANGES.map(([r, l]) => <Chip key={r} active={range === r} onClick={() => setRange(r)}>{l}</Chip>)}<Chip active={mode === "area"} onClick={() => setMode(mode === "area" ? "candles" : "area")}>Line</Chip></>}>
          {isLoading ? <Empty><Spinner /></Empty> : error ? <Empty>History unavailable: {error.message}</Empty> : !data?.bars.length ? <Empty>No historical data.</Empty> : (
            <div className="p-2"><PriceChart bars={data.bars} mode={inst?.assetClass === "rate" ? "area" : mode} decimals={inst?.decimals ?? 2} height={420} /></div>
          )}
        </Panel>
        <Panel title="Related news">
          <NewsFeed query={`asset=${encodeURIComponent(symbol)}&limit=40`} compact empty="No news linked to this asset (keyword-based classification)." />
        </Panel>
      </div>
    </div>
  );
}
