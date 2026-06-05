import "../wallet-page.css";
import WalletPage from "../../../components/WalletPage";

type Params = { address: string };

export default async function WalletDetailPage({ params }: { params: Promise<Params> }) {
  const { address } = await params;
  return <WalletPage address={address} />;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { address } = await params;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return { title: `${short} — Chain Screener Wallet Explorer` };
}
