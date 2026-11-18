import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { correlationMatrix, dailyReturns } from "@/lib/correlation";
import { yahooHistory } from "@/lib/providers/yahoo";
import { pool } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

const SYMBOLS = ["^GSPC", "^NDX", "^STOXX50E", "^N225", "EURUSD=X", "JPY=X", "GC=F", "CL=F", "BTC-USD", "^VIX", "^TNX"];
let cache: { at: number; data: unknown } | null = null;

export const GET = handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return NextResponse.json(cache.data);
  const res = await pool(SYMBOLS, 3, async (s) => [s, dailyReturns((await yahooHistory(s, "6mo")).bars)] as const);
  const series: Record<string, Map<string, number>> = {};
  for (const r of res) if (r.status === "fulfilled") series[r.value[0]] = r.value[1];
  const m = correlationMatrix(series);
  const data = { ...m, window: "6 months, daily returns", computedAt: new Date().toISOString(), note: "^TNX = US 10-year yield (Cboe). Closes occur at different times across markets: asynchronous correlations." };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
});
