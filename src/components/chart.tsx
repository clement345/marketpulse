"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, AreaSeries, HistogramSeries, ColorType, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { HistoryBar } from "@/lib/providers/types";

export function PriceChart({ bars, mode = "candles", height = 380, decimals = 2 }: { bars: HistoryBar[]; mode?: "candles" | "area"; height?: number; decimals?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b919e", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "#1b1f27" }, horzLines: { color: "#1b1f27" } },
      rightPriceScale: { borderColor: "#232731" },
      timeScale: { borderColor: "#232731", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      localization: {
        locale: "fr-FR",
        timeFormatter: (t: number) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000)),
        priceFormatter: (p: number) => p.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
      },
      autoSize: true,
    });
    chartRef.current = chart;
    const data = bars.map((b) => ({ ...b, time: b.time as UTCTimestamp }));
    const up = data.length > 1 && data[data.length - 1].close >= data[0].close;
    if (mode === "candles") {
      const s = chart.addSeries(CandlestickSeries, { upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444" });
      s.setData(data);
    } else {
      const s = chart.addSeries(AreaSeries, { lineColor: up ? "#22c55e" : "#ef4444", topColor: up ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)", bottomColor: "rgba(0,0,0,0)", lineWidth: 2 });
      s.setData(data.map((b) => ({ time: b.time, value: b.close })));
    }
    if (data.some((b) => b.volume)) {
      const v = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, color: "#2e3340", lastValueVisible: false, priceLineVisible: false });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.06, bottom: 0.22 } });
      v.setData(data.filter((b) => b.volume).map((b) => ({ time: b.time, value: b.volume!, color: b.close >= b.open ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)" })));
    }
    chart.timeScale().fitContent();
    return () => { chart.remove(); chartRef.current = null; };
  }, [bars, mode, height, decimals]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
