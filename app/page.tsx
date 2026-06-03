import { Dashboard } from "../components/Dashboard";
import { fetchDashboardData } from "../lib/api";

export default async function Home() {
  const data = await fetchDashboardData();
  return <Dashboard initialTokens={data.tokens} initialTrending={data.trending} />;
}
