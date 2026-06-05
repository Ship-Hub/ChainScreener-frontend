export const dynamic = "force-dynamic";

import { Dashboard } from "../components/Dashboard";
import { fetchDashboardData } from "../lib/api";

export default async function Home() {
  const data = await fetchDashboardData();
  return (
    <Dashboard
      initialTokens={data.tokens}
      initialTrending={data.trending}
      initialLivePools={data.livePools}
      initialLiveSwaps={data.liveSwaps}
      alertCount={Object.values(data.alertCounts).reduce((sum, count) => sum + count, 0)}
    />
  );
}
