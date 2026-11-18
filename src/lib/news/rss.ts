import { XMLParser } from "fast-xml-parser";

export interface RawItem { title: string; url: string; summary: string | null; publishedAt: Date | null }

// text fields are read raw (stopNodes): some feeds slip unescaped HTML into them
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, processEntities: true, htmlEntities: true,
  stopNodes: ["*.title", "*.description", "*.summary", "*.content", "*.encoded"],
});

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

export function cleanText(s: unknown, max = 600): string {
  if (s === null || s === undefined) return "";
  let t = typeof s === "object" ? String((s as Record<string, unknown>)["#text"] ?? "") : String(s);
  const decode = (x: string) => x.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? (m.startsWith("&#") ? String.fromCharCode(parseInt(m.slice(2).replace(/^x/i, "0x"))) : m));
  t = t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ");
  t = decode(decode(t)).replace(/<[^>]+>/g, " "); // escaped HTML (&lt;p&gt;) then double escaping (&amp;amp;)
  t = t.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function linkOf(l: unknown): string {
  if (!l) return "";
  if (typeof l === "string") return l;
  if (Array.isArray(l)) {
    const alt = l.find((x) => x?.["@_rel"] === "alternate") ?? l[0];
    return linkOf(alt);
  }
  const o = l as Record<string, unknown>;
  return String(o["@_href"] ?? o["#text"] ?? "");
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(cleanText(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse RSS 2.0, RSS 1.0 (RDF) and Atom. */
export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item ?? doc?.RDF?.item ?? doc?.channel?.item;
  const atomEntries = doc?.feed?.entry;
  const list = (rssItems ?? atomEntries ?? []) as unknown;
  const arr = (Array.isArray(list) ? list : [list]) as Record<string, unknown>[];
  return arr
    .map((it) => {
      const title = cleanText(it.title, 300);
      const url = linkOf(it.link) || cleanText(it.guid) || linkOf(it.id);
      const summary = cleanText(it.description ?? it.summary ?? it.content ?? "", 600) || null;
      const publishedAt = parseDate(it.pubDate ?? it.published ?? it.updated ?? it.date);
      return { title, url: url.trim(), summary: summary && summary !== title ? summary : null, publishedAt };
    })
    .filter((x) => x.title && /^https?:\/\//.test(x.url));
}
