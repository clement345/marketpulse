import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { generateReport } from "@/lib/reports/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (req: Request) => {
  const kind = new URL(req.url).searchParams.get("kind");
  const reports = await prisma.report.findMany({ where: kind ? { kind } : undefined, orderBy: { generatedAt: "desc" }, take: 30 });
  return NextResponse.json({ reports });
});

/** Manual generation ("regenerate now"). */
export const POST = handler(async (req: Request) => {
  const { kind } = z.object({ kind: z.enum(["morning_brief", "market_wrap"]) }).parse(await req.json());
  const content = await generateReport(kind);
  return NextResponse.json({ content });
});
