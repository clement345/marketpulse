import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const lists = await prisma.watchlist.findMany({ orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" } } } });
  return NextResponse.json({ watchlists: lists });
});

export const POST = handler(async (req: Request) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(await req.json());
  const count = await prisma.watchlist.count();
  const wl = await prisma.watchlist.create({ data: { name, position: count }, include: { items: true } });
  return NextResponse.json({ watchlist: wl });
});
