import { NextResponse } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api";
import { answerQuestion } from "@/lib/ai/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(async (req: Request) => {
  const body = z.object({
    question: z.string().trim().min(2).max(2000),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).default([]),
  }).parse(await req.json());
  return NextResponse.json(await answerQuestion(body.question, body.history));
});
