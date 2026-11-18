import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { refreshQuotes } from "@/lib/quotesService";

export const dynamic = "force-dynamic";

/** Manual quotes refresh (limited to 1 per 20 s). */
let last = 0;
export const POST = handler(async () => {
  if (Date.now() - last < 20_000) return NextResponse.json({ skipped: true });
  last = Date.now();
  const extra = await prisma.watchlistItem.findMany({ select: { symbol: true, name: true }, distinct: ["symbol"] });
  return NextResponse.json(await refreshQuotes({ include: "market", extraSymbols: extra }));
});
