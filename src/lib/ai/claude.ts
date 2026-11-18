import { spawn } from "node:child_process";

/**
 * Default AI provider: Claude Code in headless mode (`claude -p`), using the user's Claude subscription.
 * No usage cost. "Lightweight" call: no tools, no local config, no MCP, dedicated system prompt.
 * To plug in an API (Anthropic/OpenAI), implement `AiProvider` and register it in getAi().
 */
export interface AiProvider {
  id: string;
  model: string;
  complete(system: string, prompt: string, opts?: { timeoutMs?: number }): Promise<string>;
}

let running = 0;
const queue: (() => void)[] = [];
const MAX_CONCURRENT = 2;

async function acquire() {
  if (running < MAX_CONCURRENT) { running++; return; }
  await new Promise<void>((r) => queue.push(r));
  running++;
}
function release() {
  running--;
  queue.shift()?.();
}

export class ClaudeCliProvider implements AiProvider {
  id = "claude-cli";
  constructor(public model = process.env.CLAUDE_MODEL || "sonnet", private bin = process.env.CLAUDE_BIN || "claude") {}

  async complete(system: string, prompt: string, opts: { timeoutMs?: number } = {}): Promise<string> {
    await acquire();
    try {
      return await new Promise<string>((resolve, reject) => {
        const args = ["-p", "--tools", "", "--system-prompt", system, "--strict-mcp-config", "--setting-sources", "",
          "--output-format", "json", "--model", this.model, "--no-session-persistence"];
        const child = spawn(this.bin, args, { cwd: "/tmp", env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"] });
        let out = "", err = "";
        const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("AI: timeout exceeded")); }, opts.timeoutMs ?? 180_000);
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", (e) => { clearTimeout(timer); reject(new Error(`AI unavailable (${e.message}). Check CLAUDE_BIN.`)); });
        child.on("close", (code) => {
          clearTimeout(timer);
          try {
            const j = JSON.parse(out) as { result?: string; is_error?: boolean; subtype?: string };
            if (j.is_error || typeof j.result !== "string") return reject(new Error(`AI: error (${j.subtype ?? "unknown"}) ${j.result ?? ""}`.trim()));
            resolve(j.result);
          } catch {
            reject(new Error(`AI: invalid output (code ${code}) ${err.slice(0, 300)}`));
          }
        });
        child.stdin.end(prompt);
      });
    } finally {
      release();
    }
  }
}

export function getAi(): AiProvider | null {
  const p = (process.env.AI_PROVIDER || "claude-cli").toLowerCase();
  if (p === "none") return null;
  return new ClaudeCliProvider();
}

/** Extracts the first JSON object from a response (tolerates ```json ... ```). */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI: no JSON in the response");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
