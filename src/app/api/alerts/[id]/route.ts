import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { RuleInput } from "@/lib/alerts/schema";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = RuleInput.partial().parse(await req.json());
  return NextResponse.json({ rule: await prisma.alertRule.update({ where: { id }, data }) });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await prisma.alertRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
