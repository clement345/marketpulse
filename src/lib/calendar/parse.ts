/** Parsing of economic values ("0.3%", "119K", "-1.2M", "$1.15") to compute surprises. */
export function parseEconValue(v: string | null | undefined): number | null {
  if (!v) return null;
  const s = v.replace(/[$,\s<>]/g, "").replace("−", "-");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(%|K|M|B|T)?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const u = (m[2] ?? "").toUpperCase();
  if (u === "K") n *= 1e3; else if (u === "M") n *= 1e6; else if (u === "B") n *= 1e9; else if (u === "T") n *= 1e12;
  return n;
}

/** Difference between actual and consensus, expressed in the displayed unit (percentage points or K for employment). */
export function computeSurprise(actual: string | null | undefined, consensus: string | null | undefined): number | null {
  const a = parseEconValue(actual), c = parseEconValue(consensus);
  if (a === null || c === null) return null;
  const unit = (actual ?? "").trim().slice(-1).toUpperCase();
  const d = a - c;
  if (unit === "K") return Math.round(d / 1e3 * 10) / 10;
  if (unit === "M") return Math.round(d / 1e6 * 100) / 100;
  if (unit === "B") return Math.round(d / 1e9 * 100) / 100;
  return Math.round(d * 1000) / 1000;
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
