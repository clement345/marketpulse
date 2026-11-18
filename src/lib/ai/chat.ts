import { getAi } from "./claude";
import { eventsBlock, GROUNDING_RULES, newsBlock, quotesBlock, type SourceRef } from "./context";
import { formatParis } from "../time";

const SYSTEM = `You are the market analysis assistant of MarketPulse, a personal financial terminal. You answer questions about the markets using the data actually collected by the application.
${GROUNDING_RULES}
Format: concise Markdown. Start with the direct answer, then the sourced factual elements, then (if useful) a clearly separated "Assumptions" section. End with a "Limits:" line if data is missing or delayed.`;

export interface ChatTurn { role: "user" | "assistant"; content: string }

export async function answerQuestion(question: string, history: ChatTurn[] = []): Promise<{ answer: string; sources: SourceRef[] }> {
  const ai = getAi();
  if (!ai) throw new Error("AI disabled (AI_PROVIDER=none)");
  const lookback = /semaine|week|7 ?j/i.test(question) ? 96 : 36;
  const [q, n, ev] = await Promise.all([
    quotesBlock(),
    newsBlock({ question, hours: lookback, limit: 30 }),
    eventsBlock({ fromHours: -48, toHours: 7 * 24, minImportance: 2 }),
  ]);
  const hist = history.slice(-6).map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content.slice(0, 1500)}`).join("\n\n");
  const prompt = `Current date and time: ${formatParis(new Date(), { dateStyle: "full", timeStyle: "short" })} (Europe/Paris)

${q.text}

${n.text}

${ev.text}

${hist ? `CONVERSATION HISTORY\n${hist}\n\n` : ""}QUESTION: ${question}`;
  const answer = await ai.complete(SYSTEM, prompt);
  const all = [...q.sources, ...n.sources, ...ev.sources];
  const cited = new Set([...answer.matchAll(/\[([^\]]{1,40})\]/g)].flatMap((m) => m[1].split(/[,;\s]+/)).map((x) => x.trim()).filter((x) => /^[NEQ]\d*$/.test(x)));
  return { answer, sources: all.filter((s) => cited.has(s.ref)) };
}
