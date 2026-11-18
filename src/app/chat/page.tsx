"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import { fmtDateTime } from "@/lib/time";
import type { SourceRef } from "@/lib/ai/context";
import { postJson } from "@/components/live";
import { Markdown } from "@/components/markdown";
import { Button, Panel, Spinner } from "@/components/ui";

interface Msg { role: "user" | "assistant"; content: string; sources?: SourceRef[]; error?: boolean }

const SUGGESTIONS = [
  "Why is the Nasdaq falling today?",
  "What are the three most important macro news items of the day?",
  "What events could affect EUR/USD this week?",
  "Summarize the Fed announcements over the last 24 hours.",
  "What news explains the rise in the VIX?",
];

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { try { const s = sessionStorage.getItem("mp:chat"); if (s) setMsgs(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem("mp:chat", JSON.stringify(msgs.slice(-30))); } catch {} endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setInput(""); setBusy(true);
    try {
      const r = await postJson<{ answer: string; sources: SourceRef[] }>("/api/chat", { question, history });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, sources: r.sources }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Error: ${(e as Error).message}`, error: true }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col p-2">
      <Panel title="AI Analyst" subtitle="answers only from the collected quotes, news and events"
        actions={msgs.length > 0 && <Button size="xs" variant="ghost" onClick={() => setMsgs([])}><Trash2 size={12} /> Clear</Button>} bodyClassName="flex flex-col">
        <div className="flex-1 space-y-3 overflow-auto p-3">
          {!msgs.length && (
            <div className="mx-auto max-w-2xl py-6 text-center">
              <Bot className="mx-auto text-accent" size={28} />
              <p className="mt-2 text-xs text-muted">Ask a question about the markets. The assistant cites its sources ([N] news, [E] calendar, [Q] quotes), distinguishes facts from assumptions, and flags missing data.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded border border-line-2 px-2.5 py-1.5 text-left text-xs text-muted hover:border-accent/60 hover:text-fg">{s}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-md bg-accent/10 px-3 py-2 text-xs" : "max-w-4xl rounded-md border border-line bg-panel-2/50 px-3 py-2 text-xs"}>
              {m.role === "user" ? m.content : (
                <>
                  <div className={m.error ? "text-down" : ""}><Markdown text={m.content} refs={Object.fromEntries((m.sources ?? []).map((s) => [s.ref, { url: s.url, title: `${s.source} — ${s.title}` }]))} /></div>
                  {!!m.sources?.length && (
                    <div className="mt-2 border-t border-line pt-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Cited sources</div>
                      {m.sources.map((s) => (
                        <div key={s.ref} className="truncate text-[11px] text-muted">
                          <span className="num mr-1 text-dim">[{s.ref}]</span>
                          {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-info">{s.source} — {s.title}</a> : <span>{s.source} — {s.title}</span>}
                          <span className="ml-1 text-dim">· {fmtDateTime(s.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-xs text-dim"><Spinner /> Analyzing collected data (≈15-60 s)…</div>}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-line p-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            rows={2} placeholder="Your question… (Enter to send, Shift+Enter for a new line)" className="flex-1 resize-none rounded border border-line-2 bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent/70" />
          <Button type="submit" variant="accent" disabled={busy || !input.trim()} className="self-end"><Send size={13} /></Button>
        </form>
      </Panel>
    </div>
  );
}
