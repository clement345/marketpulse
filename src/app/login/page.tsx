"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";

function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <form className="w-72 space-y-3 rounded-md border border-line bg-panel p-5" onSubmit={async (e) => {
        e.preventDefault(); setErr(null);
        const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
        if (r.ok) router.replace(next.startsWith("/") ? next : "/"); else setErr((await r.json()).error);
      }}>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 bg-accent" /><span className="text-xs font-bold tracking-[0.2em]">MARKETPULSE</span></div>
        <Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe" className="w-full" />
        {err && <div className="text-xs text-down">{err}</div>}
        <Button type="submit" variant="accent" className="w-full">Entrer</Button>
      </form>
    </div>
  );
}
export default function Page() { return <Suspense><Login /></Suspense>; }
