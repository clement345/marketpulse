import { describe, expect, it } from "vitest";
import { classify } from "@/lib/news/classify";
import { findCluster, isSameEvent, normalizeUrl } from "@/lib/news/dedup";
import { cleanText, parseFeed } from "@/lib/news/rss";

describe("deduplication", () => {
  it("normalizes URLs (tracking, www, trailing slash)", () => {
    expect(normalizeUrl("https://www.cnbc.com/2026/a.html?utm_source=x&id=3#top")).toBe("https://cnbc.com/2026/a.html?id=3");
  });
  it("groups headlines describing the same event", () => {
    expect(isSameEvent("Italy fines Meta $887 million over Android users' data access", "Italy fines Meta €805 million over access to Android users’ photos")).toBe(true);
    expect(isSameEvent("China, US discuss tariffs, farm trade ahead of Xi-Trump meeting", "China, US Discuss Tariffs in First Meeting of Trade Council")).toBe(true);
  });
  it("does not group different topics", () => {
    expect(isSameEvent("Fed's Collins says gradual rate hikes appropriate", "Oil prices fall as OPEC raises output")).toBe(false);
    expect(findCluster("Apple shares rise after earnings beat", [{ clusterId: "x", title: "Nvidia shares fall on export curbs" }])).toBeNull();
  });
});

describe("classification", () => {
  it("detects central bank, countries and assets", () => {
    const c = classify({ title: "Fed's Powell signals rate hike as inflation persists", feedWeight: 3 });
    expect(c.category).toBe("monetary_policy");
    expect(c.countries).toContain("US");
    expect(c.assets).toContain("US2Y");
    expect(c.importance).toBeGreaterThanOrEqual(3);
  });
  it("FOMC statement = maximum importance", () => {
    const c = classify({ title: "Federal Reserve issues FOMC statement", feedWeight: 3, official: true, forceCategory: "monetary_policy", country: "US" });
    expect(c.importance).toBe(5);
  });
  it("recognizes companies and cashtags", () => {
    const c = classify({ title: "Nvidia earnings beat estimates; $AMD slips", feedWeight: 2 });
    expect(c.category).toBe("earnings");
    expect(c.assets).toEqual(expect.arrayContaining(["NVDA", "AMD"]));
  });
  it("does not confuse the pronoun “us” with the United States", () => {
    expect(classify({ title: "Tell us what you think about markets", feedWeight: 1 }).countries).not.toContain("US");
  });
});

describe("RSS/Atom parsing", () => {
  it("reads an RSS 2.0 feed with CDATA and entities", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Stocks &amp; bonds rally]]></title><link>https://ex.com/a</link><description>&lt;p&gt;Hello <b>world</b>&lt;/p&gt;</description><pubDate>Fri, 13 Nov 2026 14:00:00 GMT</pubDate></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Stocks & bonds rally");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-13T14:00:00.000Z");
    expect(items[0].summary).toBe("Hello world");
  });
  it("reads an Atom feed", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>8-K filing</title><link rel="alternate" href="https://sec.gov/x"/><updated>2026-11-12T10:00:00-05:00</updated><summary>Item 2.02</summary></entry></feed>`;
    const [e] = parseFeed(xml);
    expect(e.url).toBe("https://sec.gov/x");
    expect(e.publishedAt?.toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });
  it("truncates cleanly", () => {
    expect(cleanText("a".repeat(700), 10)).toHaveLength(10);
  });
});
