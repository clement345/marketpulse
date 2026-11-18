import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const where: Prisma.NewsItemWhereInput = { isPrimary: true };
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { source: { contains: q, mode: "insensitive" } }];
  if (p.get("category")) where.category = { in: p.get("category")!.split(",") };
  if (p.get("country")) where.countries = { hasSome: p.get("country")!.split(",") };
  if (p.get("asset")) where.assets = { hasSome: p.get("asset")!.split(",") };
  if (p.get("source")) where.source = { in: p.get("source")!.split(",") };
  if (p.get("minImportance")) where.importance = { gte: Number(p.get("minImportance")) };
  if (p.get("favorites") === "1") where.favorite = true;
  if (p.get("breaking") === "1") {
    where.importance = { gte: 4 };
    where.publishedAt = { gte: new Date(Date.now() - 24 * 3600_000) };
  }
  const before = p.get("before");
  if (before) where.publishedAt = { ...(where.publishedAt as object), lt: new Date(before) };
  const limit = Math.min(Number(p.get("limit") ?? 60), 200);

  const items = await prisma.newsItem.findMany({
    where,
    orderBy: p.get("breaking") === "1" ? [{ importance: "desc" }, { publishedAt: "desc" }] : { publishedAt: "desc" },
    take: limit,
    include: { analysis: { select: { id: true } } },
  });
  const clusterIds = items.map((i) => i.clusterId);
  const related = await prisma.newsItem.findMany({
    where: { clusterId: { in: clusterIds }, isPrimary: false },
    select: { clusterId: true, source: true, url: true, title: true, publishedAt: true },
    orderBy: { publishedAt: "asc" },
  });
  return NextResponse.json({
    items: items.map(({ analysis, ...n }) => ({
      ...n,
      hasAnalysis: !!analysis,
      related: related.filter((r) => r.clusterId === n.clusterId),
    })),
  });
});
