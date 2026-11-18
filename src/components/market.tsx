"use client";
import { cn, fmtNum, fmtSigned } from "@/lib/utils";
import { FRESHNESS_LABEL, type Freshness } from "@/lib/freshness";
import type { QuoteView } from "@/lib/views";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { useEffect, useRef, useState } from "react";
import { Badge } from "./ui";

export function Sparkline({ data, width = 96, height = 28, prevClose, className }: { data: [number, number][]; width?: number; height?: number; prevClose?: number | null; className?: string }) {
  if (data.length < 2) return <div style={{ width, height }} className={cn("flex items-center justify-center text-[9px] text-dim", className)}>n/a</div>;
  const vals = data.map((d) => d[1]);
  const ref = prevClose ?? vals[0];
  const min = Math.min(...vals, ref), max = Math.max(...vals, ref);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const up = vals[vals.length - 1] >= ref;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <line x1={0} x2={width} y1={y(ref)} y2={y(ref)} stroke="var(--color-line-2)" strokeDasharray="2 2" strokeWidth={1} />
      <path d={`${path}L${width},${height}L0,${height}Z`} fill={color} opacity={0.08} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.3} />
    </svg>
  );
}

export function Change({ q, className, mode = "pct" }: { q: Pick<QuoteView, "changePct" | "change" | "changeBp" | "decimals">; className?: string; mode?: "pct" | "abs" | "both" }) {
  const v = q.changeBp ?? q.changePct ?? null;
  const tone = v === null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
  if (q.changeBp !== null && q.changeBp !== undefined) return <span className={cn("num", tone, className)}>{fmtSigned(q.changeBp, 1, " bp")}</span>;
  return (
    <span className={cn("num", tone, className)}>
      {mode !== "pct" && fmtSigned(q.change, q.decimals)}
      {mode === "both" && " "}
      {mode !== "abs" && (mode === "both" ? `(${fmtSigned(q.changePct, 2, "%")})` : fmtSigned(q.changePct, 2, "%"))}
    </span>
  );
}

const FRESH_TONE: Record<Freshness, "up" | "info" | "down" | "muted" | "default"> = { live: "up", delayed: "info", stale: "down", close: "muted", eod: "default" };

export function FreshnessBadge({ q }: { q: Pick<QuoteView, "freshness" | "quoteTime" | "provider" | "fetchedAt"> }) {
  const title = `Source quote: ${fmtDateTime(q.quoteTime)} (Paris)\nFetched: ${fmtDateTime(q.fetchedAt)}\nProvider: ${q.provider}`;
  return <Badge tone={FRESH_TONE[q.freshness]} title={title}>{FRESHNESS_LABEL[q.freshness]}</Badge>;
}

export function MarketDot({ state }: { state: string }) {
  const open = state === "open" || state === "always";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", open ? "bg-up shadow-[0_0_6px] shadow-up" : state === "break" ? "bg-accent" : "bg-dim")} />;
}

/** Applies a green/red flash when the price changes. */
export function useFlash(price: number | undefined) {
  const prev = useRef(price);
  const [cls, setCls] = useState("");
  useEffect(() => {
    if (price === undefined || prev.current === undefined) { prev.current = price; return; }
    if (price !== prev.current) {
      setCls(price > prev.current ? "flash-up" : "flash-down");
      const t = setTimeout(() => setCls(""), 1200);
      prev.current = price;
      return () => clearTimeout(t);
    }
  }, [price]);
  return cls;
}

export function Price({ q, className }: { q: Pick<QuoteView, "price" | "decimals" | "unit">; className?: string }) {
  return <span className={cn("num", className)}>{fmtNum(q.price, q.decimals)}{q.unit ?? ""}</span>;
}

export function quoteTimeLabel(q: Pick<QuoteView, "quoteTime" | "freshness">) {
  const d = new Date(q.quoteTime);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? fmtTime(d) : fmtDateTime(d);
}
