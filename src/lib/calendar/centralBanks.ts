import { fetchWithRetry } from "../http";
import { zonedTimeToUtc } from "../time";
import type { CalEvent } from "./forexfactory";

/**
 * Official calendars of monetary policy meetings, extracted from the public pages:
 * - Fed: federalreserve.gov/monetarypolicy/fomccalendars.htm (statement 14:00 New York, press conf. 14:30)
 * - ECB: ecb.europa.eu/press/calendars/mgcgc (decision 14:15 Frankfurt, press conf. 14:45)
 */
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

export function parseFomcPage(html: string): { y: number; m: number; d: number; sep: boolean }[] {
  const out: { y: number; m: number; d: number; sep: boolean }[] = [];
  const heads = [...html.matchAll(/(\d{4}) FOMC Meetings/g)];
  heads.forEach((h, i) => {
    const year = +h[1];
    const seg = html.slice(h.index!, heads[i + 1]?.index ?? html.length);
    for (const m of seg.matchAll(/fomc-meeting__month[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)) {
      const monthTxt = m[1].trim().toLowerCase(); // "april/may" possible
      const dateTxt = m[2].trim(); // "28-29", "17-18*", "30-1", "11 (notation vote)"
      if (/notation|unscheduled|conference call/i.test(dateTxt)) continue;
      const dm = dateTxt.match(/(\d{1,2})(?:-(\d{1,2}))?(\*)?/);
      if (!dm) continue;
      const months = monthTxt.split("/").map((x) => MONTHS[x.trim()]).filter(Boolean);
      if (!months.length) continue;
      const lastDay = +(dm[2] ?? dm[1]);
      const month = months.length > 1 && dm[2] && +dm[2] < +dm[1] ? months[1] : months[0];
      out.push({ y: year, m: month, d: lastDay, sep: !!dm[3] });
    }
  });
  return out;
}

export function parseEcbCalendar(html: string): { y: number; m: number; d: number }[] {
  const out: { y: number; m: number; d: number }[] = [];
  for (const m of html.matchAll(/<dt>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) {
    const txt = m[4].replace(/<[^>]+>/g, " ");
    if (/monetary policy meeting/i.test(txt) && /press conference/i.test(txt)) out.push({ y: +m[3], m: +m[2], d: +m[1] });
  }
  return out;
}

export async function fetchCentralBankMeetings(): Promise<CalEvent[]> {
  const events: CalEvent[] = [];
  const [fomcHtml, ecbHtml] = await Promise.all([
    fetchWithRetry("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm").then((r) => r.text()),
    fetchWithRetry("https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html").then((r) => r.text()),
  ]);
  for (const f of parseFomcPage(fomcHtml)) {
    const key = `${f.y}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`;
    events.push({
      id: `fed:fomc:${key}`, kind: "central_bank", title: `FOMC Decision (Fed)${f.sep ? " + projections (SEP)" : ""}`, country: "USD",
      scheduledAt: zonedTimeToUtc(f.y, f.m, f.d, 14, 0, "America/New_York"), allDay: false, importance: 3,
      previous: null, consensus: null, actual: null, source: "fed", sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    });
    events.push({
      id: `fed:presser:${key}`, kind: "speech", title: "Fed Chair press conference", country: "USD",
      scheduledAt: zonedTimeToUtc(f.y, f.m, f.d, 14, 30, "America/New_York"), allDay: false, importance: 3,
      previous: null, consensus: null, actual: null, source: "fed", sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    });
  }
  for (const e of parseEcbCalendar(ecbHtml)) {
    const key = `${e.y}-${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`;
    events.push({
      id: `ecb:decision:${key}`, kind: "central_bank", title: "ECB Monetary Policy Decision", country: "EUR",
      scheduledAt: zonedTimeToUtc(e.y, e.m, e.d, 14, 15, "Europe/Berlin"), allDay: false, importance: 3,
      previous: null, consensus: null, actual: null, source: "ecb", sourceUrl: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
    });
    events.push({
      id: `ecb:presser:${key}`, kind: "speech", title: "ECB President press conference", country: "EUR",
      scheduledAt: zonedTimeToUtc(e.y, e.m, e.d, 14, 45, "Europe/Berlin"), allDay: false, importance: 3,
      previous: null, consensus: null, actual: null, source: "ecb", sourceUrl: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
    });
  }
  const cutoff = Date.now() - 60 * 86400_000;
  return events.filter((e) => e.scheduledAt.getTime() >= cutoff);
}
