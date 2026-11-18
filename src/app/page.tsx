"use client";
import { useEffect, useState } from "react";
import { Panel as RPanel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CorrelationMatrix, CrossAssetMonitor, MarketOverview, PanelMenu, UpcomingEvents, usePanelPrefs } from "@/components/dashboard";
import { NewsFeed } from "@/components/news";
import { Panel } from "@/components/ui";
import Link from "next/link";

function useIsDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    setD(m.matches);
    const f = (e: MediaQueryListEvent) => setD(e.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return d;
}

export default function Dashboard() {
  const panelPrefs = usePanelPrefs();
  const { prefs } = panelPrefs;
  const desktop = useIsDesktop();

  const overview = <Panel title="Market Overview" subtitle="Equity indices">{<MarketOverview />}</Panel>;
  const cross = <CrossAssetMonitor />;
  const breaking = <Panel title="Breaking News" subtitle="importance ≥ 4 · 24 h" actions={<Link href="/news?tab=breaking" className="text-[11px] text-dim hover:text-fg">All →</Link>}><NewsFeed query="breaking=1&limit=25" compact empty="No major news in the last 24 h." /></Panel>;
  const events = <Panel title="Agenda" subtitle="72 h · importance ≥ medium" actions={<Link href="/calendar" className="text-[11px] text-dim hover:text-fg">Calendar →</Link>}><UpcomingEvents /></Panel>;
  const correl = <Panel title="Cross-asset correlations">{<CorrelationMatrix />}</Panel>;

  const left = [prefs.overview && { id: "overview", el: overview, size: 45 }, prefs.cross && { id: "cross", el: cross, size: 35 }, prefs.correl && { id: "correl", el: correl, size: 20 }].filter(Boolean) as { id: string; el: React.ReactNode; size: number }[];
  const right = [prefs.breaking && { id: "breaking", el: breaking, size: 55 }, prefs.events && { id: "events", el: events, size: 45 }].filter(Boolean) as { id: string; el: React.ReactNode; size: number }[];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-1">
        <h1 className="text-xs font-semibold uppercase tracking-widest text-muted">Dashboard</h1>
        <PanelMenu {...panelPrefs} />
      </div>
      {desktop ? (
        <PanelGroup direction="horizontal" autoSaveId={`mp-main-${left.length}-${right.length}`} className="min-h-0 flex-1 p-2">
          {left.length > 0 && (
            <RPanel defaultSize={62} minSize={30}>
              <PanelGroup direction="vertical" autoSaveId={`mp-left-${left.map((x) => x.id).join("-")}`}>
                {left.map((p, i) => (
                  <Frag key={p.id} sep={i > 0} vertical><RPanel id={p.id} order={i} defaultSize={p.size} minSize={12}>{p.el}</RPanel></Frag>
                ))}
              </PanelGroup>
            </RPanel>
          )}
          {left.length > 0 && right.length > 0 && <PanelResizeHandle className="mx-1 w-px" />}
          {right.length > 0 && (
            <RPanel defaultSize={38} minSize={20}>
              <PanelGroup direction="vertical" autoSaveId={`mp-right-${right.map((x) => x.id).join("-")}`}>
                {right.map((p, i) => (
                  <Frag key={p.id} sep={i > 0} vertical><RPanel id={p.id} order={i} defaultSize={p.size} minSize={12}>{p.el}</RPanel></Frag>
                ))}
              </PanelGroup>
            </RPanel>
          )}
        </PanelGroup>
      ) : (
        <div className="space-y-2 p-2">
          {[...left, ...right].map((p) => <div key={p.id} className={p.id === "overview" ? "" : "h-[480px]"}>{p.el}</div>)}
        </div>
      )}
    </div>
  );
}

function Frag({ children, sep, vertical }: { children: React.ReactNode; sep: boolean; vertical?: boolean }) {
  return (
    <>
      {sep && <PanelResizeHandle className={vertical ? "my-1 h-px" : "mx-1 w-px"} />}
      {children}
    </>
  );
}
