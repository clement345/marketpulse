import { prisma } from "../db";
import { sha1Hex } from "../hash";
import { fetchWithRetry, recordProvider } from "../http";
import { classify } from "./classify";
import { findCluster, normalizeUrl } from "./dedup";
import { FEEDS, secFeeds, yahooTickerFeeds, type FeedDef } from "./feeds";
import { parseFeed, type RawItem } from "./rss";
import { pool } from "../providers/types";

const MAX_AGE_MS = 7 * 86400_000;

async function fetchFeed(feed: FeedDef): Promise<RawItem[]> {
  const headers: Record<string, string> = { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" };
  if (feed.id.startsWith("sec-") && process.env.SEC_USER_AGENT) headers["User-Agent"] = process.env.SEC_USER_AGENT;
  const res = await fetchWithRetry(feed.url, { headers, retries: 1, timeoutMs: 15000 });
  return parseFeed(await res.text());
}

export async function ingestNews(watchTickers: string[] = []): Promise<{ inserted: number; feedsOk: number; feedsFailed: string[] }> {
  const equityTickers = watchTickers.filter((t) => !/[=^]/.test(t) && !t.endsWith("-USD"));
  const feeds = [...FEEDS.filter((f) => !f.enabled || f.enabled()), ...yahooTickerFeeds(equityTickers), ...secFeeds(equityTickers)];

  const results = await pool(feeds, 5, async (f) => ({ f, items: await fetchFeed(f) }));
  const feedsFailed: string[] = [];
  const all: { f: FeedDef; it: RawItem }[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const f = feeds[i];
    if (r.status === "fulfilled") {
      await recordProvider(`rss:${f.id}`, true);
      for (const it of r.value.items) all.push({ f, it });
    } else {
      feedsFailed.push(f.id);
      await recordProvider(`rss:${f.id}`, false, r.reason);
    }
  }

  const now = Date.now();
  // oldest first: the first article about an event becomes the cluster representative
  all.sort((a, b) => (a.it.publishedAt?.getTime() ?? now) - (b.it.publishedAt?.getTime() ?? now));

  const hashes = all.map(({ it }) => sha1Hex(normalizeUrl(it.url)));
  const existing = new Set((await prisma.newsItem.findMany({ where: { urlHash: { in: hashes } }, select: { urlHash: true } })).map((x) => x.urlHash));
  const recent = await prisma.newsItem.findMany({
    where: { publishedAt: { gte: new Date(now - 36 * 3600_000) }, isPrimary: true },
    select: { clusterId: true, title: true },
  });

  let inserted = 0;
  const seen = new Set<string>();
  for (let i = 0; i < all.length; i++) {
    const { f, it } = all[i];
    const urlHash = hashes[i];
    if (existing.has(urlHash) || seen.has(urlHash)) continue;
    seen.add(urlHash);
    // date missing from the feed: use the time of receipt (never an invented, more recent date)
    const publishedAt = it.publishedAt && it.publishedAt.getTime() <= now + 5 * 60_000 ? it.publishedAt : new Date(now);
    if (now - publishedAt.getTime() > MAX_AGE_MS) continue;

    const c = classify({ title: it.title, summary: it.summary, feedWeight: f.weight, official: f.official, forceCategory: f.forceCategory, country: f.country, watchTickers });
    const clusterHit = findCluster(it.title, recent);
    const id = sha1Hex(`n:${urlHash}`).slice(0, 24);
    const clusterId = clusterHit ?? id;

    try {
      await prisma.newsItem.create({
        data: {
          id, urlHash, url: it.url, title: it.title, summary: it.summary, source: f.source, feed: f.id, publishedAt,
          category: c.category, countries: c.countries, assets: c.assets, importance: c.importance,
          isBreaking: c.importance >= 4, clusterId, isPrimary: !clusterHit,
        },
      });
      inserted++;
      if (!clusterHit) recent.push({ clusterId: id, title: it.title });
      else await bumpCluster(clusterId, c.assets, c.importance);
    } catch (e) {
      if (!String(e).includes("Unique constraint")) throw e;
    }
  }
  return { inserted, feedsOk: feeds.length - feedsFailed.length, feedsFailed };
}

/** An event covered by several sources gains importance; assets are aggregated. */
async function bumpCluster(clusterId: string, assets: string[], importance: number) {
  const [primary, size] = await Promise.all([
    prisma.newsItem.findUnique({ where: { id: clusterId } }),
    prisma.newsItem.count({ where: { clusterId } }),
  ]);
  if (!primary) return;
  const mergedAssets = [...new Set([...primary.assets, ...assets])];
  let imp = Math.max(primary.importance, importance);
  if (size === 3) imp = Math.min(5, Math.max(imp, primary.importance + 1));
  await prisma.newsItem.update({ where: { id: clusterId }, data: { assets: mergedAssets, importance: imp, isBreaking: imp >= 4 } });
}
