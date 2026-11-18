/**
 * Deterministic (rule-based) classification: category, country, affected assets, importance.
 * Fast, free, auditable. AI complements it on important news.
 */

export type Category =
  | "monetary_policy" | "macro" | "earnings" | "geopolitics" | "commodities" | "crypto"
  | "fx" | "rates" | "regulation" | "corporate" | "equities" | "other";

export const CATEGORY_LABEL: Record<string, string> = {
  monetary_policy: "Central banks", macro: "Macro", earnings: "Earnings", geopolitics: "Geopolitics",
  commodities: "Commodities", crypto: "Crypto", fx: "Currencies", rates: "Rates", regulation: "Regulation",
  corporate: "Corporate", equities: "Equities", other: "Other",
};

const CATEGORY_RULES: [Category, RegExp][] = [
  ["monetary_policy", /\b(fed|fomc|federal reserve|powell|ecb|lagarde|central bank|boj|bank of japan|boe|bank of england|rate (cut|hike|decision)s?|interest rates?|monetary policy|policymakers?|dot plot|quantitative (easing|tightening))\b/i],
  ["macro", /\b(inflation|cpi|pce|consumer prices|jobs report|payrolls?|nfp|unemployment|jobless|gdp|pmi|ism|retail sales|recession|economy|economic data|consumer confidence|housing starts|durable goods|ppi|wages)\b/i],
  ["earnings", /\b(earnings|quarterly results|results|revenue|profit|guidance|eps|beats? estimates|miss(es)? estimates|outlook|forecasts? (raised|cut)|q[1-4] (sales|results))\b/i],
  ["geopolitics", /\b(war|sanctions?|tariffs?|ukraine|russia|israel|iran|gaza|taiwan|missile|ceasefire|election|trade war|geopolitic\w*|nato|opec\+?)\b/i],
  ["commodities", /\b(oil|crude|brent|wti|gold|silver|copper|natural gas|lng|commodit\w+|wheat|opec)\b/i],
  ["crypto", /\b(bitcoin|btc|ethereum|ether|crypto\w*|stablecoins?|blockchain|coinbase|binance)\b/i],
  ["fx", /\b(dollar|euro|yen|sterling|pound|yuan|currenc\w+|forex|fx|eur\/usd|usd\/jpy)\b/i],
  ["rates", /\b(treasur(y|ies)|yields?|bonds?|bund|gilts?|jgbs?|10-year|2-year|curve)\b/i],
  ["regulation", /\b(sec|antitrust|regulators?|lawsuit|probe|fine[sd]?|investigation|doj|ftc|eu commission)\b/i],
  ["corporate", /\b(merger|acquisition|acquire[sd]?|takeover|deal|ipo|layoffs?|ceo|buyback|spin-?off|bankruptcy|chapter 11|8-k)\b/i],
  ["equities", /\b(stocks?|shares|equit(y|ies)|s&p|nasdaq|dow|index|indices|wall street|rally|sell-?off|market)\b/i],
];

const COUNTRY_RULES: [string, RegExp][] = [
  ["US", /\b(u\.s|united states|america\w*|fed|fomc|wall street|treasur(y|ies)|powell|washington|trump|s&p|nasdaq|dow)\b/i],
  ["EU", /\b(euro ?zone|euro area|ecb|lagarde|european union|eu|europe\w*|brussels|stoxx)\b/i],
  ["FR", /\b(france|french|paris|cac|macron)\b/i],
  ["DE", /\b(germany|german|berlin|dax|bund|bundesbank)\b/i],
  ["GB", /\b(uk|u\.k|britain|british|bank of england|boe|london|ftse|gilts?)\b/i],
  ["JP", /\b(japan\w*|boj|bank of japan|tokyo|nikkei|yen|jgbs?)\b/i],
  ["CN", /\b(china|chinese|beijing|yuan|pboc|shanghai)\b/i],
  ["HK", /\b(hong kong|hang seng)\b/i],
];

/** Keywords -> internal symbols. */
const ASSET_RULES: [string, RegExp][] = [
  ["^GSPC", /\b(s&p ?500|s&p|wall street|u\.s\. stocks|us stocks)\b/i],
  ["^NDX", /\b(nasdaq|tech stocks)\b/i],
  ["^DJI", /\b(dow jones|the dow|dow)\b/i],
  ["^RUT", /\b(russell 2000|small[- ]caps?)\b/i],
  ["^FCHI", /\b(cac 40|cac|french stocks|paris bourse)\b/i],
  ["^STOXX50E", /\b(stoxx|european stocks|europe'?s stocks|european shares)\b/i],
  ["^GDAXI", /\b(dax|german stocks)\b/i],
  ["^N225", /\b(nikkei|japanese stocks|tokyo stocks)\b/i],
  ["^HSI", /\b(hang seng|hong kong stocks)\b/i],
  ["EURUSD=X", /\b(eur\/usd|euro|ecb)\b/i],
  ["JPY=X", /\b(usd\/jpy|yen|boj|bank of japan)\b/i],
  ["GBPUSD=X", /\b(gbp\/usd|sterling|pound|bank of england|boe)\b/i],
  ["BTC-USD", /\b(bitcoin|btc|crypto\w*)\b/i],
  ["ETH-USD", /\b(ethereum|ether)\b/i],
  ["GC=F", /\b(gold|bullion)\b/i],
  ["CL=F", /\b(oil|crude|wti|opec)\b/i],
  ["BZ=F", /\b(brent)\b/i],
  ["^VIX", /\b(vix|volatility index|fear gauge)\b/i],
  ["US10Y", /\b(treasur(y|ies)|10-year|bond yields?|yields)\b/i],
  ["US2Y", /\b(2-year|two-year|fed|fomc|powell)\b/i],
  ["EA10Y", /\b(bunds?|euro ?zone bonds?|ecb)\b/i],
];

/** Large caps: name -> Yahoo ticker. */
export const COMPANIES: [string, RegExp][] = [
  ["AAPL", /\bapple\b/i], ["MSFT", /\bmicrosoft\b/i], ["NVDA", /\bnvidia\b/i], ["AMZN", /\bamazon\b/i],
  ["GOOGL", /\b(alphabet|google)\b/i], ["META", /\b(meta platforms|meta|facebook)\b/i], ["TSLA", /\btesla\b/i],
  ["BRK-B", /\bberkshire\b/i], ["JPM", /\bjpmorgan\b/i], ["GS", /\bgoldman\b/i], ["MS", /\bmorgan stanley\b/i],
  ["BAC", /\bbank of america\b/i], ["C", /\bcitigroup|citi\b/i], ["WFC", /\bwells fargo\b/i], ["NFLX", /\bnetflix\b/i],
  ["AMD", /\bamd\b|\badvanced micro\b/i], ["INTC", /\bintel\b/i], ["AVGO", /\bbroadcom\b/i], ["ORCL", /\boracle\b/i],
  ["CRM", /\bsalesforce\b/i], ["BA", /\bboeing\b/i], ["WMT", /\bwalmart\b/i], ["XOM", /\bexxon\b/i], ["CVX", /\bchevron\b/i],
  ["MC.PA", /\blvmh\b/i], ["TTE.PA", /\btotalenergies\b/i], ["AIR.PA", /\bairbus\b/i], ["BNP.PA", /\bbnp paribas\b/i],
  ["GLE.PA", /\bsoci[ée]t[ée] g[ée]n[ée]rale\b/i], ["SAN.PA", /\bsanofi\b/i], ["OR.PA", /\bl'?or[ée]al\b/i],
  ["ASML", /\basml\b/i], ["SAP", /\bsap\b/], ["SIE.DE", /\bsiemens\b/i], ["VOW3.DE", /\bvolkswagen\b/i],
  ["TM", /\btoyota\b/i], ["SONY", /\bsony\b/i], ["TSM", /\btsmc|taiwan semiconductor\b/i], ["BABA", /\balibaba\b/i],
  ["0700.HK", /\btencent\b/i], ["PLTR", /\bpalantir\b/i], ["COIN", /\bcoinbase\b/i], ["UBER", /\buber\b/i],
  ["DIS", /\bdisney\b/i], ["NKE", /\bnike\b/i], ["PFE", /\bpfizer\b/i], ["LLY", /\beli lilly|lilly\b/i],
  ["NVO", /\bnovo nordisk\b/i], ["UNH", /\bunitedhealth\b/i], ["V", /\bvisa\b/], ["MA", /\bmastercard\b/i],
  ["BLK", /\bblackrock\b/i], ["SHEL", /\bshell\b/], ["BP", /\bbp\b/], ["HSBC", /\bhsbc\b/i], ["MSTR", /\bmicrostrategy|strategy inc\b/i],
];

const HIGH_IMPACT = /\b(rate decision|raises? rates|cuts? rates|hikes? rates|holds? rates|fomc statement|emergency|plunges?|crash\w*|tumbles?|soars?|surges?|record high|record low|default|bankruptcy|chapter 11|war|invasion|halts?|breaking|downgrade|recession|shock|collapse|stimulus|intervention|beats?|misses?)\b/i;
const MACRO_PRINT = /\b(cpi|pce|payrolls|nfp|jobs report|gdp|unemployment rate|ism|pmi)\b/i;

export interface ClassifyInput { title: string; summary?: string | null; feedWeight: number; official?: boolean; forceCategory?: string; country?: string; watchTickers?: string[] }
export interface Classification { category: Category; countries: string[]; assets: string[]; importance: number }

export function classify(input: ClassifyInput): Classification {
  const text = `${input.title} ${input.summary ?? ""}`;
  const title = input.title;

  let category: Category = (input.forceCategory as Category) ?? "other";
  if (!input.forceCategory) {
    // the title takes precedence over the summary
    category = CATEGORY_RULES.find(([, re]) => re.test(title))?.[0] ?? CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? "other";
  }

  const countries = new Set<string>(input.country ? [input.country] : []);
  for (const [c, re] of COUNTRY_RULES) if (re.test(text)) countries.add(c);

  const assets = new Set<string>();
  for (const [sym, re] of ASSET_RULES) if (re.test(title) || (re.test(text) && category !== "other")) assets.add(sym);
  for (const [sym, re] of COMPANIES) if (re.test(title)) assets.add(sym);
  for (const m of text.matchAll(/\$([A-Z]{1,5})\b/g)) assets.add(m[1]);
  for (const t of input.watchTickers ?? []) {
    if (t.length >= 3 && !t.startsWith("^") && new RegExp(`\\b${t.replace(/[.^=$-]/g, "\\$&")}\\b`).test(title)) assets.add(t);
  }

  let importance = input.feedWeight >= 3 ? 2 : 1;
  if (category === "monetary_policy" || category === "macro") importance += 1;
  if (HIGH_IMPACT.test(title)) importance += 1;
  if (MACRO_PRINT.test(title)) importance += 1;
  if (input.official) {
    importance = Math.max(importance, 3);
    if (/\b(fomc statement|monetary policy decisions?|federal open market committee|press conference|monetary policy statement)\b/i.test(title)) importance = 5;
  }
  importance = Math.max(1, Math.min(5, importance));

  return { category, countries: [...countries], assets: [...assets], importance };
}
