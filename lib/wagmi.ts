import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, bsc } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Chain Screener",
  projectId: "chainscreener", // WalletConnect project ID (can be updated later)
  chains: [base, mainnet, bsc],
  ssr: true,
});
