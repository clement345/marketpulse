/**
 * Catalogue of instruments tracked by default.
 * `symbol` = internal identifier AND symbol at the primary provider (Yahoo).
 * To replace a provider, just change `provider` / `providerSymbol`.
 */
export type AssetClass = "index" | "fx" | "crypto" | "commodity" | "volatility" | "rate" | "equity" | "etf";
export type ExchangeId = "NYSE" | "CBOE" | "EURONEXT" | "XETRA" | "STOXX" | "JPX" | "HKEX" | "FX" | "CRYPTO" | "CME" | "ICE" | "BONDS_US" | "BONDS_EU";

export interface Instrument {
  symbol: string;
  name: string;
  short: string;
  assetClass: AssetClass;
  exchange: ExchangeId;
  provider: "yahoo" | "treasury" | "ecb" | "binance";
  providerSymbol?: string;
  region: "US" | "EU" | "ASIA" | "GLOBAL";
  unit?: string; // "%" for yields
  decimals: number;
}

export const INDICES: Instrument[] = [
  { symbol: "^GSPC", name: "S&P 500", short: "SPX", assetClass: "index", exchange: "NYSE", provider: "yahoo", region: "US", decimals: 2 },
  { symbol: "^NDX", name: "Nasdaq 100", short: "NDX", assetClass: "index", exchange: "NYSE", provider: "yahoo", region: "US", decimals: 2 },
  { symbol: "^DJI", name: "Dow Jones", short: "DJI", assetClass: "index", exchange: "NYSE", provider: "yahoo", region: "US", decimals: 2 },
  { symbol: "^RUT", name: "Russell 2000", short: "RUT", assetClass: "index", exchange: "NYSE", provider: "yahoo", region: "US", decimals: 2 },
  { symbol: "^FCHI", name: "CAC 40", short: "CAC", assetClass: "index", exchange: "EURONEXT", provider: "yahoo", region: "EU", decimals: 2 },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", short: "SX5E", assetClass: "index", exchange: "STOXX", provider: "yahoo", region: "EU", decimals: 2 },
  { symbol: "^GDAXI", name: "DAX", short: "DAX", assetClass: "index", exchange: "XETRA", provider: "yahoo", region: "EU", decimals: 2 },
  { symbol: "^N225", name: "Nikkei 225", short: "NKY", assetClass: "index", exchange: "JPX", provider: "yahoo", region: "ASIA", decimals: 2 },
  { symbol: "^HSI", name: "Hang Seng", short: "HSI", assetClass: "index", exchange: "HKEX", provider: "yahoo", region: "ASIA", decimals: 2 },
];

export const CROSS_ASSET: Instrument[] = [
  { symbol: "EURUSD=X", name: "EUR/USD", short: "EURUSD", assetClass: "fx", exchange: "FX", provider: "yahoo", region: "GLOBAL", decimals: 4 },
  { symbol: "JPY=X", name: "USD/JPY", short: "USDJPY", assetClass: "fx", exchange: "FX", provider: "yahoo", region: "GLOBAL", decimals: 2 },
  { symbol: "GBPUSD=X", name: "GBP/USD", short: "GBPUSD", assetClass: "fx", exchange: "FX", provider: "yahoo", region: "GLOBAL", decimals: 4 },
  { symbol: "BTC-USD", name: "Bitcoin", short: "BTC", assetClass: "crypto", exchange: "CRYPTO", provider: "binance", providerSymbol: "BTCUSDT", region: "GLOBAL", decimals: 0 },
  { symbol: "ETH-USD", name: "Ethereum", short: "ETH", assetClass: "crypto", exchange: "CRYPTO", provider: "binance", providerSymbol: "ETHUSDT", region: "GLOBAL", decimals: 2 },
  { symbol: "GC=F", name: "Gold (future)", short: "GOLD", assetClass: "commodity", exchange: "CME", provider: "yahoo", region: "GLOBAL", decimals: 1 },
  { symbol: "CL=F", name: "WTI Crude Oil (future)", short: "WTI", assetClass: "commodity", exchange: "CME", provider: "yahoo", region: "GLOBAL", decimals: 2 },
  { symbol: "BZ=F", name: "Brent Crude Oil (future)", short: "BRENT", assetClass: "commodity", exchange: "ICE", provider: "yahoo", region: "GLOBAL", decimals: 2 },
  { symbol: "^VIX", name: "VIX", short: "VIX", assetClass: "volatility", exchange: "CBOE", provider: "yahoo", region: "US", decimals: 2 },
  { symbol: "US2Y", name: "US Treasury 2-year", short: "US2Y", assetClass: "rate", exchange: "BONDS_US", provider: "treasury", providerSymbol: "BC_2YEAR", region: "US", unit: "%", decimals: 2 },
  { symbol: "US10Y", name: "US Treasury 10-year", short: "US10Y", assetClass: "rate", exchange: "BONDS_US", provider: "treasury", providerSymbol: "BC_10YEAR", region: "US", unit: "%", decimals: 2 },
  { symbol: "EA2Y", name: "Eurozone 2-year (ECB AAA curve)", short: "EA2Y", assetClass: "rate", exchange: "BONDS_EU", provider: "ecb", providerSymbol: "SR_2Y", region: "EU", unit: "%", decimals: 2 },
  { symbol: "EA10Y", name: "Eurozone 10-year (ECB AAA curve)", short: "EA10Y", assetClass: "rate", exchange: "BONDS_EU", provider: "ecb", providerSymbol: "SR_10Y", region: "EU", unit: "%", decimals: 2 },
];

export const DEFAULT_INSTRUMENTS = [...INDICES, ...CROSS_ASSET];

export function findInstrument(symbol: string): Instrument | undefined {
  return DEFAULT_INSTRUMENTS.find((i) => i.symbol === symbol);
}

export const ASSET_CLASS_LABEL: Record<string, string> = {
  index: "Indices", fx: "Currencies", crypto: "Crypto", commodity: "Commodities",
  volatility: "Volatility", rate: "Rates", equity: "Equities", etf: "ETFs",
};
