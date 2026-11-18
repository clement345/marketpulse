import { NextResponse } from "next/server";
import { handler, HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { yahooHistory } from "@/lib/providers/yahoo";
import { findInstrument } from "@/lib/instruments";

export const dynamic = "force-dynamic";
const cache = new Map<string, { at: number; data: unknown }>();

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const range = url.searchParams.get("range") ?? "6mo";
  if (!symbol) throw new HttpError(400, "symbol required");
  const inst = findInstrument(symbol);
  // Rates: no intraday history, return the stored official daily series
  if (inst && (inst.provider === "treasury" || inst.provider === "ecb")) {
    const q = await prisma.quote.findUnique({ where: { symbol } });
    const pts = ((q?.sparkline as [number, number][]) ?? []).map(([t, v]) => ({ time: t, open: v, high: v, low: v, close: v }));
    return NextResponse.json({ symbol, range: "1mo", bars: pts, source: inst.provider, note: "Official daily series (last 30 points)" });
  }
  const key = `${symbol}:${range}`;
  const ttl = range === "1d" ? 60_000 : 10 * 60_000;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return NextResponse.json(hit.data);
  // for crypto, Yahoo provides the history (Binance = real time)
  const h = await yahooHistory(symbol, range);
  const data = { symbol, range, bars: h.bars, tz: h.tz, currency: h.currency, source: "yahoo" };
  cache.set(key, { at: Date.now(), data });
  return NextResponse.json(data);
});
