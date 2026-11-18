/**
 * News feeds. Only public RSS/Atom feeds published by the publishers themselves.
 * We store title + feed-provided summary + link: no paywall circumvention, no article scraping.
 * Verified on 14/11/2026. Reuters no longer has a public RSS feed (not included).
 */
export interface FeedDef {
  id: string;
  source: string;
  url: string;
  weight: number; // reliability / editorial weight (1..3)
  official?: boolean; // official release (central bank, regulator)
  forceCategory?: string;
  country?: string;
  enabled?: () => boolean;
}

export const FEEDS: FeedDef[] = [
  { id: "bloomberg-markets", source: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", weight: 3 },
  { id: "bloomberg-economics", source: "Bloomberg", url: "https://feeds.bloomberg.com/economics/news.rss", weight: 3 },
  { id: "ft-markets", source: "Financial Times", url: "https://www.ft.com/markets?format=rss", weight: 3 },
  { id: "cnbc-top", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", weight: 2 },
  { id: "cnbc-economy", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258", weight: 2 },
  { id: "cnbc-markets", source: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069", weight: 2 },
  { id: "marketwatch-top", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", weight: 2 },
  { id: "marketwatch-pulse", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse", weight: 2 },
  { id: "investing-stocks", source: "Investing.com", url: "https://www.investing.com/rss/news_25.rss", weight: 1 },
  { id: "investing-economy", source: "Investing.com", url: "https://www.investing.com/rss/news_14.rss", weight: 1 },
  { id: "investing-forex", source: "Investing.com", url: "https://www.investing.com/rss/news_1.rss", weight: 1 },
  { id: "investing-commodities", source: "Investing.com", url: "https://www.investing.com/rss/news_11.rss", weight: 1 },
  { id: "yahoo-indices", source: "Yahoo Finance", url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,%5EDJI,%5EVIX&region=US&lang=en-US", weight: 1 },
  { id: "fed-press", source: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", weight: 3, official: true, forceCategory: "monetary_policy", country: "US" },
  { id: "fed-speeches", source: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/speeches.xml", weight: 3, official: true, forceCategory: "monetary_policy", country: "US" },
  { id: "ecb-press", source: "BCE", url: "https://www.ecb.europa.eu/rss/press.html", weight: 3, official: true, forceCategory: "monetary_policy", country: "EU" },
];

/** Yahoo feeds per ticker (watchlists), grouped in batches. */
export function yahooTickerFeeds(tickers: string[]): FeedDef[] {
  const out: FeedDef[] = [];
  for (let i = 0; i < tickers.length; i += 8) {
    const chunk = tickers.slice(i, i + 8);
    out.push({
      id: `yahoo-watch-${i / 8}`,
      source: "Yahoo Finance",
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${chunk.map(encodeURIComponent).join(",")}&region=US&lang=en-US`,
      weight: 1,
    });
  }
  return out;
}

/** SEC EDGAR: 8-K filings per company (requires SEC_USER_AGENT with a contact email, SEC rule). */
export function secFeeds(tickers: string[]): FeedDef[] {
  if (!process.env.SEC_USER_AGENT) return [];
  return tickers
    .filter((t) => /^[A-Z.]{1,6}$/.test(t)) // US stocks only
    .map((t) => ({
      id: `sec-${t}`,
      source: "SEC EDGAR",
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${t}&type=8-K&dateb=&owner=include&count=10&output=atom`,
      weight: 3,
      official: true,
      forceCategory: "corporate",
      country: "US",
    }));
}
