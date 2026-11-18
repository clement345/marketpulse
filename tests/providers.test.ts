import { describe, expect, it } from "vitest";
import { parseYahooQuote } from "@/lib/providers/yahoo";
import { parseTreasuryXml } from "@/lib/providers/treasury";
import { parseEcbCsv } from "@/lib/providers/ecb";
import { correlationMatrix, pearson } from "@/lib/correlation";
import { evaluateQuoteRule } from "@/lib/alerts/engine";

describe("provider parsers", () => {
  it("Yahoo: price, change, source timestamp", () => {
    const q = parseYahooQuote({ chart: { result: [{ meta: { symbol: "^GSPC", currency: "USD", regularMarketPrice: 7561.67, chartPreviousClose: 7592.04, regularMarketTime: 1794606199, exchangeTimezoneName: "America/New_York" }, timestamp: [1, 2, 3], indicators: { quote: [{ close: [7600, null, 7561.67] }] } }], error: null } });
    expect(q.price).toBe(7561.67);
    expect(q.changePct!).toBeCloseTo(-0.4, 1);
    expect(q.quoteTime.toISOString()).toBe(new Date(1794606199000).toISOString());
    expect(q.sparkline).toHaveLength(2);
    expect(q.latency).toBe("delayed");
  });
  it("Yahoo: rejects a response without a price (never an invented price)", () => {
    expect(() => parseYahooQuote({ chart: { result: [{ meta: { symbol: "X" } as never, indicators: { quote: [{}] } }], error: null } })).toThrow();
  });
  it("Treasury: extracts maturities by date", () => {
    const xml = `<feed><entry><content><m:properties><d:NEW_DATE>2026-11-12T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.85</d:BC_2YEAR><d:BC_10YEAR>5.10</d:BC_10YEAR></m:properties></content></entry><entry><content><m:properties><d:NEW_DATE>2026-11-13T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.88</d:BC_2YEAR><d:BC_10YEAR>5.15</d:BC_10YEAR></m:properties></content></entry></feed>`;
    const rows = parseTreasuryXml(xml);
    expect(rows.map((r) => r.date)).toEqual(["2026-11-12", "2026-11-13"]);
    expect(rows[1].values.BC_10YEAR).toBe(5.15);
  });
  it("ECB: SDMX CSV", () => {
    const csv = `KEY,FREQ,TIME_PERIOD,OBS_VALUE\nYC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,2026-11-12,3.36\nYC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,2026-11-11,3.34`;
    const d = parseEcbCsv(csv);
    expect(d.SR_10Y.map((x) => x.date)).toEqual(["2026-11-11", "2026-11-12"]);
  });
});

describe("correlations", () => {
  it("pearson", () => {
    const x = Array.from({ length: 20 }, (_, i) => i);
    expect(pearson(x, x.map((v) => 2 * v + 1))).toBeCloseTo(1);
    expect(pearson(x, x.map((v) => -v))).toBeCloseTo(-1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it("date-aligned matrix", () => {
    const a = new Map(Array.from({ length: 15 }, (_, i) => [`d${i}`, i % 3]));
    const m = correlationMatrix({ A: a, B: a });
    expect(m.matrix[0][1]).toBeCloseTo(1);
  });
});

describe("price alerts", () => {
  const quotes = [
    { symbol: "^GSPC", name: "S&P 500", price: 7400, changePct: -2.5, quoteTime: new Date("2026-11-10T20:00:00Z") },
    { symbol: "^VIX", name: "VIX", price: 24, changePct: 18, quoteTime: new Date("2026-11-10T20:00:00Z") },
  ];
  it("triggers on a large index move", () => {
    const hits = evaluateQuoteRule({ id: "r1", type: "pct_move", symbol: null, threshold: 2 }, quotes);
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toContain("S&P 500");
  });
  it("triggers on a VIX spike and a price threshold", () => {
    expect(evaluateQuoteRule({ id: "r2", type: "vix_spike", symbol: null, threshold: 10 }, quotes)).toHaveLength(1);
    expect(evaluateQuoteRule({ id: "r3", type: "price_below", symbol: "^GSPC", threshold: 7500 }, quotes)).toHaveLength(1);
    expect(evaluateQuoteRule({ id: "r4", type: "price_above", symbol: "^GSPC", threshold: 7500 }, quotes)).toHaveLength(0);
  });
  it("stable dedup key over the day (no spam)", () => {
    const a = evaluateQuoteRule({ id: "r1", type: "pct_move", symbol: null, threshold: 2 }, quotes, new Date("2026-11-10T20:00:00Z"));
    const b = evaluateQuoteRule({ id: "r1", type: "pct_move", symbol: null, threshold: 2 }, quotes, new Date("2026-11-10T20:05:00Z"));
    expect(a[0].dedupKey).toBe(b[0].dedupKey);
  });
});
