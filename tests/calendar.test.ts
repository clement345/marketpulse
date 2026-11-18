import { describe, expect, it } from "vitest";
import { computeSurprise, parseEconValue } from "@/lib/calendar/parse";
import { classifyKind, mapFF } from "@/lib/calendar/forexfactory";
import { parseEcbCalendar, parseFomcPage } from "@/lib/calendar/centralBanks";
import { expectedRefMonth } from "@/lib/calendar/bls";

describe("economic values", () => {
  it("parses %, K, M, $", () => {
    expect(parseEconValue("0.3%")).toBe(0.3);
    expect(parseEconValue("119K")).toBe(119000);
    expect(parseEconValue("-1.2M")).toBe(-1200000);
    expect(parseEconValue("$1.15")).toBe(1.15);
    expect(parseEconValue("")).toBeNull();
    expect(parseEconValue("N/A")).toBeNull();
  });
  it("computes the actual/consensus gap in the displayed unit", () => {
    expect(computeSurprise("0.4%", "0.3%")).toBe(0.1);
    expect(computeSurprise("250K", "180K")).toBe(70);
    expect(computeSurprise("$1.21", "$1.15")).toBe(0.06);
    expect(computeSurprise("0.4%", null)).toBeNull();
  });
});

describe("Forex Factory", () => {
  it("converts an event and its timezone", () => {
    const e = mapFF({ title: "CPI m/m", country: "USD", date: "2026-11-10T08:30:00-05:00", impact: "High", forecast: "0.3%", previous: "0.6%" })!;
    expect(e.scheduledAt.toISOString()).toBe("2026-11-10T13:30:00.000Z");
    expect(e.importance).toBe(3);
    expect(e.consensus).toBe("0.3%");
    expect(e.actual).toBeNull();
  });
  it("classifies central bank / speech / macro", () => {
    expect(classifyKind("Federal Funds Rate")).toBe("central_bank");
    expect(classifyKind("FOMC Member Waller Speaks")).toBe("speech");
    expect(classifyKind("Non-Farm Employment Change")).toBe("macro");
  });
});

describe("official calendars", () => {
  it("parses the FOMC page (including a meeting spanning 2 months)", () => {
    const html = `<h4><a id="1">2026 FOMC Meetings</a></h4>
      <div class="fomc-meeting__month"><strong>January</strong></div><div class="fomc-meeting__date">27-28</div>
      <div class="fomc-meeting__month"><strong>April/May</strong></div><div class="fomc-meeting__date">30-1*</div>`;
    expect(parseFomcPage(html)).toEqual([{ y: 2026, m: 1, d: 28, sep: false }, { y: 2026, m: 5, d: 1, sep: true }]);
  });
  it("parses the ECB calendar", () => {
    const html = `<dt>17/12/2026</dt><dd>Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2), followed by press conference</dd><dt>18/12/2026</dt><dd>Non-monetary policy meeting</dd>`;
    expect(parseEcbCalendar(html)).toEqual([{ y: 2026, m: 12, d: 17 }]);
  });
  it("BLS reference month = month preceding the release", () => {
    expect(expectedRefMonth(new Date("2026-11-10T13:30:00Z"))).toBe("2026-10");
    expect(expectedRefMonth(new Date("2027-01-09T13:30:00Z"))).toBe("2026-12");
  });
});
