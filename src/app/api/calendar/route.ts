import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const from = p.get("from") ? new Date(p.get("from")!) : new Date(Date.now() - 86400_000);
  const to = p.get("to") ? new Date(p.get("to")!) : new Date(Date.now() + 7 * 86400_000);
  const where: Prisma.EconEventWhereInput = { scheduledAt: { gte: from, lte: to } };
  if (p.get("country")) where.country = { in: p.get("country")!.split(",") };
  if (p.get("minImportance")) where.importance = { gte: Number(p.get("minImportance")) };
  if (p.get("kind")) where.kind = { in: p.get("kind")!.split(",") };
  if (p.get("title")) where.title = p.get("title")!; // historique d'un indicateur
  const events = await prisma.econEvent.findMany({ where, orderBy: [{ scheduledAt: "asc" }, { importance: "desc" }], take: 1500 });
  const coverage = await prisma.econEvent.aggregate({ _min: { scheduledAt: true }, _max: { scheduledAt: true }, where: { source: "forexfactory" } });
  return NextResponse.json({ events, macroCoverage: { from: coverage._min.scheduledAt, to: coverage._max.scheduledAt } });
});
