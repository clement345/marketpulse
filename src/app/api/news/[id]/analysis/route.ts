import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { analyzeNews } from "@/lib/ai/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await prisma.aiAnalysis.findUnique({ where: { newsId: id } });
  return NextResponse.json({ analysis: a ? { ...a, content: a.content } : null });
});

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const content = await analyzeNews(id);
  const a = await prisma.aiAnalysis.findUnique({ where: { newsId: id } });
  return NextResponse.json({ analysis: { ...a, content } });
});
