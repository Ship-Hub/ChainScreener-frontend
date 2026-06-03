export type ChainKey = "base" | "eth" | "bsc";
export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";

export type TokenSummary = {
  chain: ChainKey;
  address: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  launchSource: string;
  dex: string;
  ageMinutes: number;
  lifecycle: "hot" | "warm" | "cold";
  priceUsd: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCapUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  volume5mUsd: number;
  volume1hUsd: number;
  volume24hUsd: number;
  buys: number;
  sells: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  holders: number;
  newHolders24h: number;
  smartWalletBuys: number;
  devWalletActivity: string;
  topHolderConcentration: number;
  riskScore: number;
  riskLevel: RiskLevel;
  trendingScore: number;
  lastActivityAt: string;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
