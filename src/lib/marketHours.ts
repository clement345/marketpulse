import type { ExchangeId } from "./instruments";
import { zonedDateKey, zonedParts } from "./time";

/**
 * Trading session hours and public holidays.
 * Holiday lists cover 2026-2027. US / Euronext / Xetra: official published calendars.
 * JPX / HKEX: 2026 only, to be re-checked every year (HKEX depends on the lunar calendar).
 */

interface Session { start: number; end: number } // minutes since midnight, local time
interface ExchangeSpec {
  tz: string;
  sessions: Session[];
  weekdaysOnly: boolean;
  holidays: Set<string>;
  earlyClose?: Record<string, number>; // date -> closing minute
  label: string;
}

const hm = (h: number, m = 0) => h * 60 + m;

const US_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
const US_EARLY = { "2026-11-27": hm(13), "2026-12-24": hm(13), "2027-11-26": hm(13) };

const EURONEXT_HOLIDAYS = new Set([
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25",
  "2027-01-01", "2027-03-26", "2027-03-29",
]);
const EURONEXT_EARLY = { "2026-12-24": hm(14, 5), "2026-12-31": hm(14, 5), "2027-12-24": hm(14, 5), "2027-12-31": hm(14, 5) };

const XETRA_HOLIDAYS = new Set([
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-24", "2026-12-25", "2026-12-31",
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-12-24", "2027-12-31",
]);

const JPX_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-02", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20", "2026-08-11",
  "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23", "2026-12-31",
]);

const HKEX_HOLIDAYS = new Set([
  "2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19", "2026-04-03", "2026-04-06", "2026-04-07",
  "2026-05-01", "2026-05-25", "2026-06-19", "2026-07-01", "2026-10-01", "2026-10-19", "2026-12-25",
]);

export const EXCHANGES: Partial<Record<ExchangeId, ExchangeSpec>> = {
  NYSE: { tz: "America/New_York", sessions: [{ start: hm(9, 30), end: hm(16) }], weekdaysOnly: true, holidays: US_HOLIDAYS, earlyClose: US_EARLY, label: "NYSE/Nasdaq" },
  CBOE: { tz: "America/New_York", sessions: [{ start: hm(9, 30), end: hm(16, 15) }], weekdaysOnly: true, holidays: US_HOLIDAYS, earlyClose: US_EARLY, label: "Cboe" },
  EURONEXT: { tz: "Europe/Paris", sessions: [{ start: hm(9), end: hm(17, 30) }], weekdaysOnly: true, holidays: EURONEXT_HOLIDAYS, earlyClose: EURONEXT_EARLY, label: "Euronext Paris" },
  STOXX: { tz: "Europe/Berlin", sessions: [{ start: hm(9), end: hm(17, 30) }], weekdaysOnly: true, holidays: XETRA_HOLIDAYS, label: "Eurex/Stoxx" },
  XETRA: { tz: "Europe/Berlin", sessions: [{ start: hm(9), end: hm(17, 30) }], weekdaysOnly: true, holidays: XETRA_HOLIDAYS, label: "Xetra" },
  JPX: { tz: "Asia/Tokyo", sessions: [{ start: hm(9), end: hm(11, 30) }, { start: hm(12, 30), end: hm(15, 30) }], weekdaysOnly: true, holidays: JPX_HOLIDAYS, label: "Tokyo SE" },
  HKEX: { tz: "Asia/Hong_Kong", sessions: [{ start: hm(9, 30), end: hm(12) }, { start: hm(13), end: hm(16) }], weekdaysOnly: true, holidays: HKEX_HOLIDAYS, label: "HKEX" },
};

export type MarketState = "open" | "closed" | "holiday" | "weekend" | "break" | "always" | "eod";

export interface MarketStatus { state: MarketState; label: string }

/** Near-continuous markets (FX, futures): open from Sunday 5pm/6pm to Friday 5pm (New York time). */
function continuousWeekStatus(now: Date, openSundayAt: number, dailyBreak?: Session): MarketStatus {
  const z = zonedParts(now, "America/New_York");
  const min = z.hour * 60 + z.minute;
  if (z.weekday === 6) return { state: "weekend", label: "Closed (weekend)" };
  if (z.weekday === 0 && min < openSundayAt) return { state: "weekend", label: "Closed (weekend)" };
  if (z.weekday === 5 && min >= hm(17)) return { state: "weekend", label: "Closed (weekend)" };
  if (dailyBreak && min >= dailyBreak.start && min < dailyBreak.end) return { state: "break", label: "Daily break" };
  return { state: "open", label: "Open" };
}

export function marketStatus(exchange: ExchangeId, now = new Date()): MarketStatus {
  switch (exchange) {
    case "CRYPTO": return { state: "always", label: "24/7" };
    case "FX": return continuousWeekStatus(now, hm(17));
    case "CME":
    case "ICE": return continuousWeekStatus(now, hm(18), { start: hm(17), end: hm(18) });
    case "BONDS_US":
    case "BONDS_EU": return { state: "eod", label: "Daily fixing" };
  }
  const spec = EXCHANGES[exchange];
  if (!spec) return { state: "closed", label: "Unknown" };
  const z = zonedParts(now, spec.tz);
  const key = zonedDateKey(now, spec.tz);
  if (spec.weekdaysOnly && (z.weekday === 0 || z.weekday === 6)) return { state: "weekend", label: "Closed (weekend)" };
  if (spec.holidays.has(key)) return { state: "holiday", label: "Closed (holiday)" };
  const min = z.hour * 60 + z.minute;
  const early = spec.earlyClose?.[key];
  const sessions = spec.sessions.map((s, i) =>
    early !== undefined && i === spec.sessions.length - 1 ? { ...s, end: Math.min(s.end, early) } : s,
  );
  if (sessions.some((s) => min >= s.start && min < s.end)) {
    return { state: "open", label: early !== undefined ? "Open (early close)" : "Open" };
  }
  if (min >= sessions[0].start && min < sessions[sessions.length - 1].end) return { state: "break", label: "Lunch break" };
  return { state: "closed", label: min < sessions[0].start ? "Pre-open" : "Closed" };
}

export function isOpenState(s: MarketState) {
  return s === "open" || s === "always";
}

/** US business day (for calendar / report calculations). */
export function isUsTradingDay(date: Date): boolean {
  const z = zonedParts(date, "America/New_York");
  return z.weekday !== 0 && z.weekday !== 6 && !US_HOLIDAYS.has(zonedDateKey(date, "America/New_York"));
}
