/** Time zone utilities based on Intl (no dependencies). */

export const PARIS = "Europe/Paris";

export interface ZonedParts {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  weekday: number; // 0 = Sunday
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(date)) p[x.type] = x.value;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
    weekday: WD[p.weekday],
  };
}

/** "YYYY-MM-DD" of the date in the given time zone. */
export function zonedDateKey(date: Date, tz: string): string {
  const z = zonedParts(date, tz);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
}

/** Minutes since midnight in the given time zone. */
export function zonedMinutes(date: Date, tz: string): number {
  const z = zonedParts(date, tz);
  return z.hour * 60 + z.minute;
}

/** Converts a "wall clock" time in a time zone to a UTC instant (handles daylight saving time). */
export function zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // two iterations are enough to converge around DST transitions
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const z = zonedParts(new Date(ts), tz);
    const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

export function formatParis(date: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, ...opts }).format(new Date(date));
}
export const fmtTime = (d: Date | string) => formatParis(d, { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (d: Date | string) =>
  formatParis(d, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function relativeAge(date: Date | string, now = new Date()): string {
  const s = Math.round((now.getTime() - new Date(date).getTime()) / 1000);
  if (s < 0) return "upcoming";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
