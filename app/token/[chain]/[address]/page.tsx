export const dynamic = "force-dynamic";

import "../../../token-page.css";
import { notFound } from "next/navigation";
import { fetchTokenDetail } from "../../../../lib/api";
import { TokenPage } from "../../../../components/TokenPage";

type Params = { chain: string; address: string };

export default async function TokenDetailPage({ params }: { params: Promise<Params> }) {
  const { chain, address } = await params;
  const token = await fetchTokenDetail(chain, address);
  if (!token) notFound();
  return <TokenPage token={token} />;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { chain, address } = await params;
  const token = await fetchTokenDetail(chain, address);
  if (!token) return { title: "Token Not Found" };
  return { title: `${token.symbol} — Chain Screener` };
}
