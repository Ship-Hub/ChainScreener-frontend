export type ChainKey = "base" | "eth" | "bsc";
export type RiskLevel = "Low" | "Medium" | "High" | "Extreme";

export type TokenSummary = {
  chain: ChainKey;
  address: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  launchSource: string;
  /** Platform key if launched via a known launchpad, e.g. "clanker" | "bankr" */
  launchPlatform: string | null;
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

export type TokenDetail = {
  chain: ChainKey;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string | null;
  marketCapUsd: number;
  priceUsd: number;
  priceChange24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  swaps24h: number;
  buys24h: number;
  sells24h: number;
  lastActivityAt: string;
  // Enriched fields
  launchPlatform: string | null;
  launchSource: string;
  dex: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Extreme";
  lifecycle: "hot" | "warm" | "cold";
  ageMinutes: number;
};

export type TokenSwap = {
  chain: ChainKey;
  dexName: string;
  protocolVersion: string;
  poolAddress: string | null;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  token0PriceUsd: number;
  token1PriceUsd: number;
  amount0Raw: string;
  amount1Raw: string;
  sender: string | null;
  txHash: string;
  blockNumber: number;
  observedAt: string;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type LivePool = {
  chain: ChainKey;
  dexKey: string;
  dexName: string;
  protocolVersion: "v2" | "v3" | "v4";
  poolAddress?: string | null;
  poolId?: string | null;
  token0: string;
  token1: string;
  token0Symbol?: string | null;
  token0Name?: string | null;
  token1Symbol?: string | null;
  token1Name?: string | null;
  fee?: number | null;
  tickSpacing?: number | null;
  hookAddress?: string | null;
  blockNumber: number;
  txHash: string;
  discoveredAt: string;
};

export type LiveSwap = {
  chain: ChainKey;
  dexKey: string;
  dexName: string;
  protocolVersion: "v2" | "v3" | "v4";
  poolAddress?: string | null;
  poolId?: string | null;
  token0?: string | null;
  token1?: string | null;
  token0Symbol?: string | null;
  token0Name?: string | null;
  token1Symbol?: string | null;
  token1Name?: string | null;
  sender?: string | null;
  recipient?: string | null;
  amount0Raw: string;
  amount1Raw: string;
  tick?: number | null;
  fee?: number | null;
  blockNumber: number;
  txHash: string;
  observedAt: string;
};

export type AlertCounts = Record<string, number>;
