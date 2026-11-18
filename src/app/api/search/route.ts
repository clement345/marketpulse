import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { yahooSearch } from "@/lib/providers/yahoo";

export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  return NextResponse.json({ results: await yahooSearch(q) });
});
