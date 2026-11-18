import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { yahooLookup } from "@/lib/providers/yahoo";
import { findInstrument } from "@/lib/instruments";
import { refreshQuotes } from "@/lib/quotesService";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { symbol } = z.object({ symbol: z.string().trim().min(1).max(30) }).parse(await req.json());
  const sym = symbol.toUpperCase();
  const inst = findInstrument(sym);
  let name = inst?.name ?? null;
  if (!inst) {
    // only add symbols that are actually listed with the provider
    const q = await yahooLookup(sym);
    if (!q) throw new HttpError(404, `Symbol "${sym}" not found on Yahoo Finance`);
    name = q.name ?? sym;
  }
  const count = await prisma.watchlistItem.count({ where: { watchlistId: id } });
  const item = await prisma.watchlistItem.upsert({
    where: { watchlistId_symbol: { watchlistId: id, symbol: sym } },
    create: { watchlistId: id, symbol: sym, name, position: count },
    update: {},
  });
  // immediate quote without waiting for the worker
  if (!inst) await refreshQuotes({ include: "market", extraSymbols: [{ symbol: sym, name }] }).catch(() => null);
  return NextResponse.json({ item });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) throw new HttpError(400, "symbol required");
  await prisma.watchlistItem.deleteMany({ where: { watchlistId: id, symbol } });
  return NextResponse.json({ ok: true });
});
