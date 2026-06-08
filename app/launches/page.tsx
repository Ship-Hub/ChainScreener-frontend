import "./launches.css";
import { LaunchesPage, type TokenSummary } from "../../components/LaunchesPage";

export const metadata = { title: "Launches — Chain Screener" };

/**
 * Fetch JSON from the API with a hard timeout.  Returns null on any error so
 * the page still renders (client-side refresh will populate data shortly after).
 */
async function safeFetch(url: string, timeoutMs = 2_500): Promise<unknown> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      // Cache for 20 s on the server (ISR) — every visitor after the first
      // within a 20 s window gets the pre-rendered result instantly.
      next: { revalidate: 20 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Launches() {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  // Run both API calls in parallel so the total SSR latency = max(launches, by-platform).
  const [launchJson, platformJson] = await Promise.all([
    safeFetch(`${api}/api/launches?limit=80`, 2_500),
    safeFetch(`${api}/api/launches/by-platform`, 1_200),
  ]);

  const initialTokens: TokenSummary[] =
    (launchJson as { data?: TokenSummary[] } | null)?.data ?? [];

  const initialPlatformTokens: Record<string, TokenSummary[]> =
    platformJson && typeof platformJson === "object" && !Array.isArray(platformJson)
      ? (platformJson as Record<string, TokenSummary[]>)
      : {};

  return (
    <LaunchesPage
      initialTokens={initialTokens}
      initialPlatformTokens={initialPlatformTokens}
    />
  );
}
