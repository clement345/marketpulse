import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(await req.json());
  return NextResponse.json({ watchlist: await prisma.watchlist.update({ where: { id }, data: { name } }) });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await prisma.watchlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
