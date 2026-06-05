import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, bsc } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Chain Screener",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [base, mainnet, bsc],
  ssr: true,
});
