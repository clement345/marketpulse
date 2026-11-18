import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

let attempts: number[] = [];

export async function POST(req: Request) {
  attempts = attempts.filter((t) => Date.now() - t < 60_000);
  if (attempts.length >= 10) return NextResponse.json({ error: "Too many attempts, try again in a minute." }, { status: 429 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD ?? "";
  const a = Buffer.from(String(password ?? "")), b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    attempts.push(Date.now());
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !!process.env.HTTPS, path: "/", maxAge: 30 * 86400 });
  return res;
}
