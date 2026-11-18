import { describe, expect, it } from "vitest";
import { marketStatus, isUsTradingDay } from "@/lib/marketHours";
import { classifyFreshness } from "@/lib/freshness";

describe("market hours", () => {
  it("NYSE open on a Tuesday at 10am NY, closed at 4:01pm", () => {
    expect(marketStatus("NYSE", new Date("2026-11-10T15:00:00Z")).state).toBe("open");
    expect(marketStatus("NYSE", new Date("2026-11-10T21:01:00Z")).state).toBe("closed");
  });
  it("NYSE closed on Thanksgiving and early close the following day", () => {
    expect(marketStatus("NYSE", new Date("2026-11-26T16:00:00Z")).state).toBe("holiday");
    expect(marketStatus("NYSE", new Date("2026-11-27T17:30:00Z")).state).toBe("open"); // 12:30 NY
    expect(marketStatus("NYSE", new Date("2026-11-27T18:30:00Z")).state).toBe("closed"); // 13:30 NY
    expect(isUsTradingDay(new Date("2026-11-26T16:00:00Z"))).toBe(false);
  });
  it("weekend and Tokyo lunch break", () => {
    expect(marketStatus("EURONEXT", new Date("2026-11-14T10:00:00Z")).state).toBe("weekend");
    expect(marketStatus("JPX", new Date("2026-11-10T03:00:00Z")).state).toBe("break"); // 12:00 Tokyo
    expect(marketStatus("JPX", new Date("2026-11-10T01:00:00Z")).state).toBe("open"); // 10:00 Tokyo
  });
  it("FX: closed Saturday, open Sunday evening NY", () => {
    expect(marketStatus("FX", new Date("2026-11-14T12:00:00Z")).state).toBe("weekend");
    expect(marketStatus("FX", new Date("2026-11-15T23:00:00Z")).state).toBe("open");
  });
  it("crypto always open, rates = daily", () => {
    expect(marketStatus("CRYPTO").state).toBe("always");
    expect(marketStatus("BONDS_US").state).toBe("eod");
  });
});

describe("data freshness", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  it("never labels delayed data as real-time", () => {
    expect(classifyFreshness({ latency: "delayed", quoteTime: new Date(now.getTime() - 60_000), marketState: "open", now })).toBe("delayed");
    expect(classifyFreshness({ latency: "realtime", quoteTime: new Date(now.getTime() - 30_000), marketState: "always", now })).toBe("live");
  });
  it("flags data that is too old when the market is open", () => {
    expect(classifyFreshness({ latency: "delayed", quoteTime: new Date(now.getTime() - 45 * 60_000), marketState: "open", now })).toBe("stale");
    expect(classifyFreshness({ latency: "realtime", quoteTime: new Date(now.getTime() - 10 * 60_000), marketState: "always", now })).toBe("delayed");
  });
  it("market closed = last close; rates = daily", () => {
    expect(classifyFreshness({ latency: "delayed", quoteTime: new Date("2026-11-06T21:00:00Z"), marketState: "weekend", now })).toBe("close");
    expect(classifyFreshness({ latency: "eod", quoteTime: now, marketState: "eod", now })).toBe("eod");
  });
});
