import { prisma } from "../db";
import { zonedMinutes, PARIS } from "../time";

export interface NotifySettings { minPriorityExternal: number; quietStart: string; quietEnd: string; maxPerHour: number }
export const DEFAULT_NOTIFY: NotifySettings = { minPriorityExternal: 2, quietStart: "23:00", quietEnd: "07:00", maxPerHour: 12 };

export async function getNotifySettings(): Promise<NotifySettings> {
  const s = await prisma.setting.findUnique({ where: { key: "notify" } });
  return { ...DEFAULT_NOTIFY, ...((s?.value as Partial<NotifySettings>) ?? {}) };
}

const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

export function inQuietHours(now: Date, s: NotifySettings): boolean {
  const m = zonedMinutes(now, PARIS), a = toMin(s.quietStart), b = toMin(s.quietEnd);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  return res.ok;
}

export async function sendEmail(subject: string, text: string): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_TO } = process.env;
  if (!SMTP_HOST || !ALERT_EMAIL_TO) return false;
  const nodemailer = await import("nodemailer");
  const t = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT || 587), auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined });
  await t.sendMail({ from: SMTP_USER || ALERT_EMAIL_TO, to: ALERT_EMAIL_TO, subject: `[MarketPulse] ${subject}`, text });
  return true;
}

/** Creates the notification (idempotent via dedupKey) and broadcasts it to the allowed external channels. */
export async function notify(n: { ruleId?: string; dedupKey: string; title: string; body: string; priority: number; url?: string; channels: string[] }): Promise<boolean> {
  const exists = await prisma.notification.findUnique({ where: { dedupKey: n.dedupKey } });
  if (exists) return false;
  await prisma.notification.create({ data: { ruleId: n.ruleId, dedupKey: n.dedupKey, title: n.title, body: n.body, priority: n.priority, url: n.url, channels: n.channels } });

  const s = await getNotifySettings();
  const now = new Date();
  const external = n.channels.filter((c) => c === "telegram" || c === "email");
  if (!external.length || n.priority < s.minPriorityExternal) return true;
  if (inQuietHours(now, s) && n.priority < 3) return true; // during quiet hours, only high-priority alerts get through
  const lastHour = await prisma.notification.count({ where: { createdAt: { gte: new Date(now.getTime() - 3600_000) }, priority: { gte: s.minPriorityExternal } } });
  if (lastHour > s.maxPerHour) return true; // anti-spam

  const text = `${n.title}\n${n.body}${n.url ? `\n${n.url}` : ""}`;
  try {
    if (external.includes("telegram")) await sendTelegram(text);
    if (external.includes("email")) await sendEmail(n.title, text);
  } catch (e) {
    console.error("[alerts] external send failed:", (e as Error).message);
  }
  return true;
}
