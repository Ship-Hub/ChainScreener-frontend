import type { AlertCounts, Candle, LivePool, LiveSwap, TokenDetail, TokenSummary, TokenSwap } from "./types";
import { mockTokens } from "./mockData";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { next: { revalidate: 10 } });
    if (!response.ok) return fallback;
    const json = (await response.json()) as { data: T };
    return json.data;
  } catch {
    return fallback;
  }
}

export async function fetchTokenDetail(chain: string, address: string): Promise<TokenDetail | null> {
  try {
    const response = await fetch(`${apiUrl}/api/tokens/${chain}/${address.toLowerCase()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const json = (await response.json()) as { data: TokenDetail };
    return json.data;
  } catch {
    return null;
  }
}

export async function fetchTokenCandles(chain: string, address: string, interval = "5m"): Promise<Candle[]> {
  return fetchJson<Candle[]>(`/api/tokens/${chain}/${address}/candles?interval=${interval}`, []);
}

export async function fetchTokenSwaps(chain: string, address: string, limit = 100): Promise<TokenSwap[]> {
  return fetchJson<TokenSwap[]>(`/api/tokens/${chain}/${address}/swaps?limit=${limit}`, []);
}

async function fetchClientJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${apiUrl}${path}`);
    if (!res.ok) return fallback;
    const json = (await res.json()) as { data: T };
    return json.data;
  } catch {
    return fallback;
  }
}

export async function fetchTopTokens(sort: "volume" | "gainers" | "losers" = "volume", chain?: string): Promise<TokenSummary[]> {
  const chainParam = chain && chain !== "all" ? `&chain=${chain}` : "";
  return fetchClientJson<TokenSummary[]>(`/api/market/tokens?sort=${sort}${chainParam}`, []);
}

export async function fetchLiveData() {
  const [tokens, livePools, liveSwaps] = await Promise.all([
    fetchClientJson<TokenSummary[]>("/api/market/tokens", []),
    fetchClientJson<LivePool[]>("/api/indexer/pools?limit=12", []),
    fetchClientJson<LiveSwap[]>("/api/indexer/swaps?limit=12", []),
  ]);
  return { tokens, livePools, liveSwaps };
}

export async function fetchDashboardData() {
  const [tokens, trending, liveMarketTokens, livePools, liveSwaps, alertCounts] = await Promise.all([
    fetchJson<TokenSummary[]>("/api/tokens", mockTokens),
    fetchJson<TokenSummary[]>("/api/trending?chain=all", mockTokens),
    fetchJson<TokenSummary[]>("/api/market/tokens", []),
    fetchJson<LivePool[]>("/api/indexer/pools?limit=12", []),
    fetchJson<LiveSwap[]>("/api/indexer/swaps?limit=12", []),
    fetchJson<AlertCounts>("/api/alerts/counts", {}),
  ]);

  const dashboardTokens = liveMarketTokens.length ? liveMarketTokens : tokens;
  const dashboardTrending = liveMarketTokens.length ? liveMarketTokens : trending;

  return { tokens: dashboardTokens, trending: dashboardTrending, livePools, liveSwaps, alertCounts };
}
