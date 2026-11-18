"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import useSWR, { SWRConfig, useSWRConfig } from "swr";
import type { QuoteView } from "@/lib/views";

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `HTTP ${r.status}`);
  return j as T;
}

export async function postJson<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `HTTP ${r.status}`);
  return j as T;
}

interface LiveState { connected: boolean; lastEvent: number | null; toasts: Toast[]; dismiss: (id: string) => void }
export interface Toast { id: string; title: string; body: string; priority: number; url?: string | null }
const LiveCtx = createContext<LiveState>({ connected: false, lastEvent: null, toasts: [], dismiss: () => {} });
export const useLive = () => useContext(LiveCtx);

function LiveInner({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      const es = new EventSource("/api/stream");
      esRef.current = es;
      es.addEventListener("hello", () => { setConnected(true); setLastEvent(Date.now()); });
      es.addEventListener("ping", () => setLastEvent(Date.now()));
      es.addEventListener("quotes", () => { setLastEvent(Date.now()); mutate((k) => typeof k === "string" && k.startsWith("/api/quotes")); });
      es.addEventListener("news", () => { setLastEvent(Date.now()); mutate((k) => typeof k === "string" && k.startsWith("/api/news")); });
      es.addEventListener("notification", (ev) => {
        const items = JSON.parse((ev as MessageEvent).data) as (Toast & { channels: string[] })[];
        mutate("/api/notifications");
        setToasts((t) => [...items.map((i) => ({ id: i.id, title: i.title, body: i.body, priority: i.priority, url: i.url })), ...t].slice(0, 4));
        for (const i of items) {
          if (i.channels?.includes("browser") && typeof Notification !== "undefined" && Notification.permission === "granted") {
            try { new Notification(i.title, { body: i.body, tag: i.id }); } catch { /* browser without support */ }
          }
        }
      });
      es.onerror = () => { setConnected(false); es.close(); retry = setTimeout(connect, 5000); };
    };
    connect();
    return () => { clearTimeout(retry); esRef.current?.close(); };
  }, [mutate]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(0, -1)), 12000);
    return () => clearTimeout(t);
  }, [toasts]);

  return <LiveCtx.Provider value={{ connected, lastEvent, toasts, dismiss: (id) => setToasts((t) => t.filter((x) => x.id !== id)) }}>{children}</LiveCtx.Provider>;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, dedupingInterval: 2000, errorRetryCount: 3 }}>
      <LiveInner>{children}</LiveInner>
    </SWRConfig>
  );
}

/** Quotes: SSE + safety net (60 s polling). */
export function useQuotes() {
  const { data, error, isLoading } = useSWR<{ asOf: string; quotes: QuoteView[] }>("/api/quotes", { refreshInterval: 60_000 });
  const map = new Map((data?.quotes ?? []).map((q) => [q.symbol, q]));
  return { quotes: data?.quotes ?? [], map, error, isLoading, asOf: data?.asOf };
}
