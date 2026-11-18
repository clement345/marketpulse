import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const [providers, quotes, news, lastNews, events, analyses] = await Promise.all([
    prisma.providerStatus.findMany({ orderBy: { id: "asc" } }),
    prisma.quote.count(),
    prisma.newsItem.count(),
    prisma.newsItem.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    prisma.econEvent.count(),
    prisma.aiAnalysis.count(),
  ]);
  return NextResponse.json({
    providers, counts: { quotes, news, events, analyses }, lastNewsFetch: lastNews?.fetchedAt ?? null,
    config: {
      ai: process.env.AI_PROVIDER || "claude-cli",
      sec: !!process.env.SEC_USER_AGENT,
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      email: !!(process.env.SMTP_HOST && process.env.ALERT_EMAIL_TO),
      auth: !!process.env.APP_PASSWORD,
    },
  });
});
