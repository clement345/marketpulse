import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { getNotifySettings } from "@/lib/alerts/notify";

export const dynamic = "force-dynamic";

export const GET = handler(async () => NextResponse.json({ notify: await getNotifySettings() }));

export const PUT = handler(async (req: Request) => {
  const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
  const notify = z.object({ minPriorityExternal: z.number().int().min(1).max(3), quietStart: hhmm, quietEnd: hhmm, maxPerHour: z.number().int().min(1).max(200) }).parse((await req.json()).notify);
  await prisma.setting.upsert({ where: { key: "notify" }, create: { key: "notify", value: notify }, update: { value: notify } });
  return NextResponse.json({ notify });
});
