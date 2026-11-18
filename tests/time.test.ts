import { describe, expect, it } from "vitest";
import { zonedDateKey, zonedTimeToUtc, zonedParts } from "@/lib/time";

describe("time zones", () => {
  it("converts a Paris time to UTC (winter and summer time)", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 7, 30, "Europe/Paris").toISOString()).toBe("2026-01-15T06:30:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 7, 30, "Europe/Paris").toISOString()).toBe("2026-07-15T05:30:00.000Z");
  });
  it("handles the US/Europe daylight saving offset (March)", () => {
    // 2026-03-10: New York already on EDT (UTC-4), Paris still on CET (UTC+1)
    expect(zonedTimeToUtc(2026, 3, 10, 9, 30, "America/New_York").toISOString()).toBe("2026-03-10T13:30:00.000Z");
  });
  it("returns the local date", () => {
    const d = new Date("2026-11-14T23:30:00Z");
    expect(zonedDateKey(d, "Europe/Paris")).toBe("2026-11-15");
    expect(zonedDateKey(d, "America/New_York")).toBe("2026-11-14");
    expect(zonedParts(d, "Europe/Paris").weekday).toBe(0);
  });
});
