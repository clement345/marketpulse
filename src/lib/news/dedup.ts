/** Deduplication: same URL = same article; similar titles (Jaccard) = same event (cluster). */

const STOP = new Set(("a an the of to in on for and or but as at by with from into after before over under amid about is are was were be been it its this that these those says say said " +
  "will would could may might new more than up down how why what who when where s u 's vs via per just").split(" "));

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|mod$|cmpid|src$|ref$|guccounter|ncid|siteid|yptr)/i.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9%$&\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^'+|'+$/g, "").replace(/'s$/, ""))
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): { score: number; shared: number } {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  return { score: union ? shared / union : 0, shared };
}

export function isSameEvent(a: string, b: string): boolean {
  const ta = titleTokens(a), tb = titleTokens(b);
  const { score, shared } = jaccard(ta, tb);
  return (score >= 0.5 && shared >= 3) || (score >= 0.8 && shared >= 2);
}

/** Returns the id of the matching cluster among the candidates, otherwise null. */
export function findCluster(title: string, candidates: { clusterId: string; title: string }[]): string | null {
  const t = titleTokens(title);
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const { score, shared } = jaccard(t, titleTokens(c.title));
    const ok = (score >= 0.5 && shared >= 3) || (score >= 0.8 && shared >= 2);
    if (ok && (!best || score > best.score)) best = { id: c.clusterId, score };
  }
  return best?.id ?? null;
}
