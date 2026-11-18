import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { toQuoteView } from "@/lib/views";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const symbols = url.searchParams.get("symbols")?.split(",").filter(Boolean);
  const quotes = await prisma.quote.findMany({ where: symbols ? { symbol: { in: symbols } } : undefined });
  const now = new Date();
  return NextResponse.json({ asOf: now.toISOString(), quotes: quotes.map((q) => toQuoteView(q, now)) });
});
