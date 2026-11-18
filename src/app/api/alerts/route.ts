import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handler } from "@/lib/api";
import { RULE_TYPES } from "@/lib/alerts/engine";
import { RuleInput } from "@/lib/alerts/schema";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const rules = await prisma.alertRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    rules, types: RULE_TYPES,
    channelsAvailable: {
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      email: !!(process.env.SMTP_HOST && process.env.ALERT_EMAIL_TO),
    },
  });
});

export const POST = handler(async (req: Request) => {
  const data = RuleInput.parse(await req.json());
  return NextResponse.json({ rule: await prisma.alertRule.create({ data: { ...data, symbol: data.symbol || null } }) });
});
