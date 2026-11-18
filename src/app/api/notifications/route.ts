import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
});

/** Marks as read (all of them, or the `ids` list). */
export const POST = handler(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  await prisma.notification.updateMany({ where: { readAt: null, ...(body.ids ? { id: { in: body.ids } } : {}) }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});
