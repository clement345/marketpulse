"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Bell, CheckCheck, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/time";
import { postJson } from "@/components/live";
import { Badge, Button, Empty, Input, Panel, Select } from "@/components/ui";

interface Rule { id: string; name: string; type: string; symbol: string | null; threshold: number | null; priority: number; cooldownMin: number; channels: string[]; enabled: boolean; lastTriggered: string | null }
interface Types { [k: string]: { label: string; needsSymbol: boolean; thresholdLabel?: string; defaultThreshold?: number } }
interface Notif { id: string; title: string; body: string; priority: number; url: string | null; createdAt: string; readAt: string | null }
interface NotifySettings { minPriorityExternal: number; quietStart: string; quietEnd: string; maxPerHour: number }

const PRIO = ["", "Low", "Normal", "High"];
const CHANNELS = [["inapp", "App"], ["browser", "Browser"], ["telegram", "Telegram"], ["email", "Email"]] as const;

export default function AlertsPage() {
  const { data, mutate } = useSWR<{ rules: Rule[]; types: Types; channelsAvailable: { telegram: boolean; email: boolean } }>("/api/alerts");
  const { data: notifs, mutate: mutN } = useSWR<{ items: Notif[]; unread: number }>("/api/notifications");
  const { data: settings, mutate: mutS } = useSWR<{ notify: NotifySettings }>("/api/settings");
  const [form, setForm] = useState({ name: "", type: "price_above", symbol: "", threshold: "", priority: 2, cooldownMin: 60, channels: ["inapp", "browser"] as string[] });
  const [err, setErr] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { setPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported"); }, []);
  const types = data?.types ?? {};
  const t = types[form.type];

  const patch = async (id: string, body: Partial<Rule>) => { await postJson(`/api/alerts/${id}`, body, "PATCH"); mutate(); };
  const create = async () => {
    setErr(null);
    try {
      await postJson("/api/alerts", {
        name: form.name || t?.label || form.type, type: form.type, symbol: form.symbol || null,
        threshold: form.threshold === "" ? t?.defaultThreshold ?? null : parseFloat(form.threshold.replace(",", ".")),
        priority: form.priority, cooldownMin: form.cooldownMin, channels: form.channels,
      });
      setForm((f) => ({ ...f, name: "", symbol: "", threshold: "" }));
      mutate();
    } catch (e) { setErr((e as Error).message); }
  };
  const chanAvail = (c: string) => c === "telegram" ? data?.channelsAvailable.telegram : c === "email" ? data?.channelsAvailable.email : true;

  return (
    <div className="grid h-full gap-2 p-2 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Alert rules" className="flex-1">
          {!data?.rules.length ? <Empty>No rules.</Empty> : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-panel"><tr className="border-b border-line text-[10px] uppercase text-dim">
                <th className="px-2 py-1 text-left font-medium">Active</th><th className="px-2 py-1 text-left font-medium">Rule</th><th className="px-2 py-1 font-medium">Priority</th>
                <th className="px-2 py-1 font-medium">Anti-spam</th><th className="px-2 py-1 font-medium">Channels</th><th className="px-2 py-1 text-right font-medium">Last</th><th />
              </tr></thead>
              <tbody>
                {data.rules.map((r) => (
                  <tr key={r.id} className={cn("border-b border-line", !r.enabled && "opacity-50")}>
                    <td className="px-2 py-1.5"><input type="checkbox" checked={r.enabled} onChange={() => patch(r.id, { enabled: !r.enabled })} className="accent-amber-500" /></td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-dim">{types[r.type]?.label}{r.symbol && ` · ${r.symbol}`}{r.threshold !== null && ` · threshold ${r.threshold}`}</div>
                    </td>
                    <td className="px-2 py-1.5 text-center"><Select value={r.priority} onChange={(e) => patch(r.id, { priority: Number(e.target.value) })}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}</Select></td>
                    <td className="px-2 py-1.5 text-center"><Select value={r.cooldownMin} onChange={(e) => patch(r.id, { cooldownMin: Number(e.target.value) })}>{[0, 15, 60, 120, 240, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "per event" : m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</Select></td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap justify-center gap-1">
                        {CHANNELS.map(([c, l]) => (
                          <button key={c} disabled={!chanAvail(c)} title={chanAvail(c) ? "" : "Not configured (.env)"} onClick={() => patch(r.id, { channels: r.channels.includes(c) ? r.channels.filter((x) => x !== c) : [...r.channels, c] })}
                            className={cn("rounded px-1 text-[10px] ring-1", r.channels.includes(c) ? "bg-accent/15 text-accent ring-accent/40" : "text-dim ring-line-2", !chanAvail(c) && "cursor-not-allowed opacity-40")}>{l}</button>
                        ))}
                      </div>
                    </td>
                    <td className="num px-2 py-1.5 text-right text-[10px] text-dim">{r.lastTriggered ? fmtDateTime(r.lastTriggered) : "—"}</td>
                    <td className="px-1"><button onClick={async () => { await postJson(`/api/alerts/${r.id}`, undefined, "DELETE"); mutate(); }} className="text-dim hover:text-down"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="New alert" className="shrink-0" bodyClassName="p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
            <Input placeholder={t?.needsSymbol ? "Symbol (e.g. ^GSPC, AAPL)" : "Symbol (optional)"} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} className="w-40" />
            {t?.thresholdLabel && <Input placeholder={`${t.thresholdLabel}${t.defaultThreshold !== undefined ? ` (def. ${t.defaultThreshold})` : ""}`} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className="w-52" />}
            <Input placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-40" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]} priority</option>)}</Select>
            <Select value={form.cooldownMin} onChange={(e) => setForm({ ...form, cooldownMin: Number(e.target.value) })}>{[0, 15, 60, 240, 1440].map((m) => <option key={m} value={m}>Max 1 / {m === 0 ? "event" : m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</Select>
            {CHANNELS.map(([c, l]) => (
              <label key={c} className={cn("flex items-center gap-1 text-xs", !chanAvail(c) && "opacity-40")}>
                <input type="checkbox" disabled={!chanAvail(c)} checked={form.channels.includes(c)} onChange={() => setForm({ ...form, channels: form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c] })} className="accent-amber-500" />{l}
              </label>
            ))}
            <Button variant="accent" size="xs" onClick={create} className="ml-auto"><Plus size={12} /> Create</Button>
          </div>
          {err && <div className="text-xs text-down">{err}</div>}
        </Panel>
      </div>
      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Notifications" subtitle={notifs ? `${notifs.unread} unread` : undefined} className="flex-1"
          actions={<Button size="xs" variant="ghost" onClick={async () => { await postJson("/api/notifications", {}); mutN(); }}><CheckCheck size={12} /> Mark all read</Button>}>
          {!notifs?.items.length ? <Empty>No notifications yet.</Empty> : notifs.items.map((n) => (
            <div key={n.id} className={cn("border-b border-line px-3 py-2 text-xs", !n.readAt && "bg-accent/5")}>
              <div className="flex items-center gap-2">
                <Badge tone={n.priority >= 3 ? "down" : n.priority === 2 ? "accent" : "default"}>{PRIO[n.priority]}</Badge>
                <span className="font-medium">{n.title}</span>
                <span className="num ml-auto text-[10px] text-dim">{fmtDateTime(n.createdAt)}</span>
              </div>
              <div className="mt-0.5 text-muted">{n.body}</div>
              {n.url && <a href={n.url} target={n.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-[11px] text-info">Open →</a>}
            </div>
          ))}
        </Panel>
        <Panel title="Anti-spam settings" className="shrink-0" bodyClassName="p-3 space-y-2 text-xs">
          {settings && (
            <form className="flex flex-wrap items-center gap-2" onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await postJson("/api/settings", { notify: { minPriorityExternal: Number(fd.get("min")), quietStart: String(fd.get("qs")), quietEnd: String(fd.get("qe")), maxPerHour: Number(fd.get("max")) } }, "PUT");
              mutS();
            }}>
              <label className="flex items-center gap-1">External from priority <Select name="min" defaultValue={settings.notify.minPriorityExternal}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}</Select></label>
              <label className="flex items-center gap-1">Quiet hours <Input name="qs" type="time" defaultValue={settings.notify.quietStart} className="w-24" />→<Input name="qe" type="time" defaultValue={settings.notify.quietEnd} className="w-24" /></label>
              <label className="flex items-center gap-1">Max/hour <Input name="max" type="number" min={1} defaultValue={settings.notify.maxPerHour} className="w-16" /></label>
              <Button size="xs" type="submit">Save</Button>
            </form>
          )}
          <p className="text-[11px] text-dim">Quiet hours: only high-priority alerts are sent to Telegram / email. The in-app history remains complete.</p>
          <div className="flex items-center gap-2">
            <Button size="xs" onClick={async () => { if (typeof Notification !== "undefined") setPerm(await Notification.requestPermission()); }}><Bell size={12} /> Browser notifications</Button>
            <span className="text-[11px] text-dim">Status: {perm === "granted" ? "allowed" : perm === "denied" ? "blocked" : perm === "unsupported" ? "unsupported" : "not requested"} (MarketPulse tab must be open)</span>
          </div>
          <div className="text-[11px] text-dim">Telegram: {data?.channelsAvailable.telegram ? "configured" : "not configured (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)"} · Email: {data?.channelsAvailable.email ? "configured" : "not configured (SMTP_*)"}</div>
        </Panel>
      </div>
    </div>
  );
}
