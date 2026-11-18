import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const n = await prisma.newsItem.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.newsItem.update({ where: { id }, data: { favorite: !n.favorite } });
  return NextResponse.json({ favorite: updated.favorite });
});
