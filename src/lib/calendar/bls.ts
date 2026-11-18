import { fetchWithRetry } from "../http";

/**
 * Actual US values from the public Bureau of Labor Statistics API (v1, no key: 25 requests/day).
 * Changes are computed from the published index levels (rounding identical to BLS in almost all cases).
 */
interface Obs { year: string; period: string; value: string }

export const BLS_MAP: { match: RegExp; compute: (s: Record<string, Obs[]>) => { value: string; refMonth: string } | null }[] = [];

const SERIES = {
  cpiSA: "CUSR0000SA0", coreSA: "CUSR0000SA0L1E", cpiNSA: "CUUR0000SA0", coreNSA: "CUUR0000SA0L1E",
  nfp: "CES0000000001", unrate: "LNS14000000", ahe: "CES0500000003", ppi: "WPSFD4", corePpi: "WPSFD49104",
};

const ym = (o: Obs) => `${o.year}-${o.period.slice(1)}`;
const pct1 = (x: number) => `${x.toFixed(1)}%`;

function mom(s: Obs[]): { value: string; refMonth: string } | null {
  if (s.length < 2) return null;
  return { value: pct1((+s[0].value / +s[1].value - 1) * 100), refMonth: ym(s[0]) };
}
function yoy(s: Obs[]): { value: string; refMonth: string } | null {
  const last = s[0];
  const prev = s.find((o) => +o.year === +last.year - 1 && o.period === last.period);
  if (!prev) return null;
  return { value: pct1((+last.value / +prev.value - 1) * 100), refMonth: ym(last) };
}

BLS_MAP.push(
  { match: /^Core CPI m\/m$/i, compute: (s) => mom(s[SERIES.coreSA]) },
  { match: /^CPI m\/m$/i, compute: (s) => mom(s[SERIES.cpiSA]) },
  { match: /^CPI y\/y$/i, compute: (s) => yoy(s[SERIES.cpiNSA]) },
  { match: /^Core CPI y\/y$/i, compute: (s) => yoy(s[SERIES.coreNSA]) },
  { match: /^Non-Farm Employment Change$/i, compute: (s) => { const x = s[SERIES.nfp]; return x?.length >= 2 ? { value: `${Math.round(+x[0].value - +x[1].value)}K`, refMonth: ym(x[0]) } : null; } },
  { match: /^Unemployment Rate$/i, compute: (s) => { const x = s[SERIES.unrate]; return x?.length ? { value: pct1(+x[0].value), refMonth: ym(x[0]) } : null; } },
  { match: /^Average Hourly Earnings m\/m$/i, compute: (s) => mom(s[SERIES.ahe]) },
  { match: /^PPI m\/m$/i, compute: (s) => mom(s[SERIES.ppi]) },
  { match: /^Core PPI m\/m$/i, compute: (s) => mom(s[SERIES.corePpi]) },
);

let cache: { at: number; data: Record<string, Obs[]> } | null = null;

export async function fetchBlsSeries(): Promise<Record<string, Obs[]>> {
  if (cache && Date.now() - cache.at < 3 * 3600_000) return cache.data;
  const y = new Date().getUTCFullYear();
  const res = await fetchWithRetry("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: Object.values(SERIES), startyear: String(y - 1), endyear: String(y) }),
    retries: 1, timeoutMs: 20000,
  });
  const json = (await res.json()) as { status: string; message?: string[]; Results?: { series: { seriesID: string; data: Obs[] }[] } };
  if (json.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS: ${json.status} ${json.message?.join(" ")}`);
  const data: Record<string, Obs[]> = {};
  for (const s of json.Results?.series ?? []) data[s.seriesID] = s.data.filter((o) => /^M(0[1-9]|1[0-2])$/.test(o.period) && o.value !== "-");
  cache = { at: Date.now(), data };
  return data;
}

/** Expected reference month for a release at the given date (release of the previous month's data). */
export function expectedRefMonth(release: Date): string {
  const y = release.getUTCFullYear(), m = release.getUTCMonth(); // m = current month (0-index) -> previous month = m
  const ry = m === 0 ? y - 1 : y;
  const rm = m === 0 ? 12 : m;
  return `${ry}-${String(rm).padStart(2, "0")}`;
}
