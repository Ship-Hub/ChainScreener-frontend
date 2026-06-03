import type { TokenSummary } from "./types";
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

export async function fetchDashboardData() {
  const [tokens, trending] = await Promise.all([
    fetchJson<TokenSummary[]>("/api/tokens", mockTokens),
    fetchJson<TokenSummary[]>("/api/trending?chain=all", mockTokens),
  ]);

  return { tokens, trending };
}
