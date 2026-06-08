import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "../components/Web3Provider";
import { NavigationProgress } from "../components/NavigationProgress";

export const metadata: Metadata = {
  title: "Chain Screener",
  description: "Multi-chain launch intelligence dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {/* Global navigation progress bar — shows on every route change */}
          <NavigationProgress />
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
