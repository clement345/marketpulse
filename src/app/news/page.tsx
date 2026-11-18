"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/news/classify";
import { DEFAULT_INSTRUMENTS } from "@/lib/instruments";
import { NewsFeed } from "@/components/news";
import { Chip, Input, Panel, Select } from "@/components/ui";

const SOURCES = ["Bloomberg", "Financial Times", "CNBC", "MarketWatch", "Investing.com", "Yahoo Finance", "Federal Reserve", "BCE", "SEC EDGAR"];
const COUNTRIES = ["US", "EU", "FR", "DE", "GB", "JP", "CN", "HK"];
const TABS = { all: "Feed", breaking: "Breaking News", favorites: "Favorites" } as const;

function NewsPage() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<keyof typeof TABS>((sp.get("tab") as keyof typeof TABS) || "all");
  const [q, setQ] = useState("");
  const [qDebounced, setQD] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [asset, setAsset] = useState(sp.get("asset") ?? "");
  const [source, setSource] = useState("");
  const [minImp, setMinImp] = useState("1");

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: "100" });
    if (tab === "breaking") p.set("breaking", "1");
    if (tab === "favorites") p.set("favorites", "1");
    if (qDebounced) p.set("q", qDebounced);
    if (category) p.set("category", category);
    if (country) p.set("country", country);
    if (asset) p.set("asset", asset);
    if (source) p.set("source", source);
    if (minImp !== "1") p.set("minImportance", minImp);
    return p.toString();
  }, [tab, qDebounced, category, country, asset, source, minImp]);

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{TABS[t]}</Chip>)}
        <form className="relative ml-auto" onSubmit={(e) => { e.preventDefault(); setQD(q.trim()); }}>
          <Search size={12} className="absolute left-2 top-2 text-dim" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setQD(q.trim())} placeholder="Search (Enter)…" className="w-56 pl-6" />
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={country} onChange={(e) => setCountry(e.target.value)}><option value="">All countries</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={asset} onChange={(e) => setAsset(e.target.value)}><option value="">All assets</option>{DEFAULT_INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}{asset && !DEFAULT_INSTRUMENTS.some((i) => i.symbol === asset) && <option value={asset}>{asset}</option>}</Select>
        <Select value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select value={minImp} onChange={(e) => setMinImp(e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Importance ≥ {n}</option>)}</Select>
      </div>
      <Panel title={TABS[tab]} subtitle="Source publication times (Paris) · automatic refresh" className="flex-1">
        <NewsFeed query={query} empty={tab === "favorites" ? "No favorites. Click ★ to add some." : "No news matches the filters."} />
      </Panel>
    </div>
  );
}

export default function Page() {
  return <Suspense><NewsPage /></Suspense>;
}
