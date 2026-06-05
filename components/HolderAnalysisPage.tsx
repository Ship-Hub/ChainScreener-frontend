"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Gem,
  Info,
  KeyRound,
  Layers,
  Lock,
  PieChart as PieChartIcon,
  Radar,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MobileBottomNav } from "./MobileBottomNav";

const DistributionPanel = dynamic(() => import("./charts/HolderPieChart"), {
  ssr: false,
  loading: () => <div style={{ height: 200, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12 }}>Loading chart…</div>,
});

const HolderGrowthChart = dynamic(() => import("./charts/HolderAreaChart"), {
  ssr: false,
  loading: () => <div style={{ height: 200, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12 }}>Loading chart…</div>,
});

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type HolderType = "Whale" | "DEX" | "Smart" | "Unknown";
type MovementAction = "BUY" | "SELL";
type TimeRange = "7D" | "30D" | "90D";

interface HolderRow {
  rank: number;
  wallet: string;
  balance: string;
  value: string;
  pctSupply: string;
  type: HolderType;
}

interface WhaleMovement {
  id: string;
  action: MovementAction;
  timeAgo: string;
  wallet: string;
  usd: string;
  tokens: string;
}


// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────

const topHolders: HolderRow[] = [
  { rank: 1,  wallet: "0x7c1e...8a2b", balance: "124.5M BRETT", value: "$26,640", pctSupply: "12.5%", type: "Whale" },
  { rank: 2,  wallet: "0x532f...8e4d", balance: "89.2M BRETT",  value: "$19,090", pctSupply: "8.9%",  type: "DEX" },
  { rank: 3,  wallet: "0x5e21...9d4a", balance: "62.4M BRETT",  value: "$13,350", pctSupply: "6.2%",  type: "Smart" },
  { rank: 4,  wallet: "0x1f32...aa11", balance: "45.8M BRETT",  value: "$9,800",  pctSupply: "4.6%",  type: "Whale" },
  { rank: 5,  wallet: "0x9a3b...7c1d", balance: "38.1M BRETT",  value: "$8,160",  pctSupply: "3.8%",  type: "Smart" },
  { rank: 6,  wallet: "0x2d4f...e9a1", balance: "31.6M BRETT",  value: "$6,760",  pctSupply: "3.2%",  type: "Unknown" },
  { rank: 7,  wallet: "0x8b3a...c120", balance: "27.4M BRETT",  value: "$5,870",  pctSupply: "2.7%",  type: "Whale" },
  { rank: 8,  wallet: "0xa4f1...3bd9", balance: "21.9M BRETT",  value: "$4,690",  pctSupply: "2.2%",  type: "DEX" },
  { rank: 9,  wallet: "0x3c82...7e55", balance: "18.2M BRETT",  value: "$3,895",  pctSupply: "1.8%",  type: "Smart" },
  { rank: 10, wallet: "0xd912...f440", balance: "14.7M BRETT",  value: "$3,150",  pctSupply: "1.5%",  type: "Unknown" },
];

const whaleMovements: WhaleMovement[] = [
  { id: "m1",  action: "BUY",  timeAgo: "2m ago",  wallet: "0x7c1e...8a2b", usd: "+$12,227",  tokens: "+1.24M BRETT" },
  { id: "m2",  action: "SELL", timeAgo: "18m ago", wallet: "0x5e21...9d4a", usd: "-$8,912",   tokens: "-1.87M BRETT" },
  { id: "m3",  action: "BUY",  timeAgo: "47m ago", wallet: "0x9a3b...7c1d", usd: "+$5,420",   tokens: "+1.12M BRETT" },
  { id: "m4",  action: "SELL", timeAgo: "1h ago",  wallet: "0x1f32...aa11", usd: "-$6,231",   tokens: "-2.44M BRETT" },
  { id: "m5",  action: "BUY",  timeAgo: "2h ago",  wallet: "0x2d4f...e9a1", usd: "+$3,100",   tokens: "+680K BRETT"  },
  { id: "m6",  action: "BUY",  timeAgo: "3h ago",  wallet: "0x8b3a...c120", usd: "+$4,780",   tokens: "+992K BRETT"  },
  { id: "m7",  action: "SELL", timeAgo: "4h ago",  wallet: "0x532f...8e4d", usd: "-$11,340",  tokens: "-3.21M BRETT" },
  { id: "m8",  action: "BUY",  timeAgo: "5h ago",  wallet: "0xa4f1...3bd9", usd: "+$2,860",   tokens: "+594K BRETT"  },
  { id: "m9",  action: "SELL", timeAgo: "7h ago",  wallet: "0x3c82...7e55", usd: "-$3,420",   tokens: "-712K BRETT"  },
  { id: "m10", action: "BUY",  timeAgo: "9h ago",  wallet: "0xd912...f440", usd: "+$7,190",   tokens: "+1.49M BRETT" },
];


// ─────────────────────────────────────────────────────────────
// Navigation config  (mirrors SmartMoneyPage)
// ─────────────────────────────────────────────────────────────
const navSections = [
  {
    title: "",
    items: [
      { label: "Radar",          icon: Radar,            route: "/" },
      { label: "Launches",       icon: Activity,         route: "/launches" },
      { label: "Watchlist",      icon: Star,             route: "/watchlist" },
      { label: "Opportunities",  icon: Gem,              route: "/opportunities" },
      { label: "Alerts",         icon: Bell,             route: "/alerts" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money",     icon: Zap,       route: "/smart-money" },
      { label: "Wallet Explorer", icon: Wallet,    route: "/wallet-explorer" },
      { label: "Holder Analysis", icon: Crosshair, route: "/holder-analysis", active: true },
      { label: "Risk Scanner",    icon: Shield,    route: "/risk-scanner" },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools",          icon: Layers,           route: "/dex-pools" },
      { label: "Liquidity Locks",    icon: Lock,             route: "/liquidity-locks" },
      { label: "Contract Analyzer",  icon: Database,         route: "/contract-analyzer" },
      { label: "Top Gainers",        icon: TrendingUp,       route: "/top-gainers" },
      { label: "Top Volume",         icon: CircleDollarSign, route: "/top-volume" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings",       icon: Settings, route: "/settings" },
      { label: "API Access",     icon: KeyRound, route: "/api-access" },
      { label: "Documentation",  icon: BookOpen, route: "/docs" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Helper: TokenLogo (same as other pages)
// ─────────────────────────────────────────────────────────────
function TokenLogo({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`tokenLogo ${tone}`}>
      <b>{label.slice(0, 2).toUpperCase()}</b>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Top Navbar
// ─────────────────────────────────────────────────────────────
function TopNavbar() {
  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb">
          <Radar size={22} />
        </span>
        <div>
          <strong>Chain Screener</strong>
          <span>Holder Analysis</span>
        </div>
      </div>
      <label className="commandSearch">
        <Search size={18} />
        <input placeholder="Search token, wallet, contract, or address..." />
        <kbd>⌘ K</kbd>
      </label>
      <div className="topActions">
        <button className="topButton" type="button">
          <Bell size={16} /> Alerts <span>12</span>
        </button>
        <button className="topButton" type="button">
          <Star size={16} /> Watchlist
        </button>
        <button className="walletButton" type="button">
          <TokenLogo label="0x" tone="blue" />
          0x8f3...a21c
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
function HaSidebar() {
  const router = useRouter();
  return (
    <aside className="haSidebar">
      <nav aria-label="Holder Analysis navigation">
        {navSections.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? (
              <span className="navSectionTitle">{section.title}</span>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = Boolean("active" in item && item.active);
              return (
                <button
                  className={`sideNavItem ${isActive ? "active" : ""}`}
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.route)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <section className="proPanel">
        <strong>
          <Gem size={16} /> Go Pro
        </strong>
        <p>Advanced analytics, real-time alerts, and unlimited scans.</p>
        <button type="button">
          Upgrade Now <ArrowRight size={15} />
        </button>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Stats Strip
// ─────────────────────────────────────────────────────────────
function StatsStrip() {
  const stats = [
    {
      label: "Total Holders",
      value: "2,193",
      change: "+18.6% (24h)",
      changeType: "pos" as const,
      icon: Users,
      iconTone: "violet",
    },
    {
      label: "New Holders (24H)",
      value: "+412",
      change: "New wallets today",
      changeType: "pos" as const,
      icon: TrendingUp,
      iconTone: "green",
    },
    {
      label: "Whale Wallets (>$10K)",
      value: "87",
      change: "-3 from yesterday",
      changeType: "neg" as const,
      icon: Zap,
      iconTone: "amber",
    },
    {
      label: "Retail Wallets",
      value: "2,106",
      change: "+415 (24h)",
      changeType: "pos" as const,
      icon: Wallet,
      iconTone: "cyan",
    },
  ] as const;

  return (
    <div className="haStatsStrip">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div className="haStat" key={s.label}>
            <div className={`haStatIcon ${s.iconTone}`}>
              <Icon size={16} />
            </div>
            <span className="haStatLabel">{s.label}</span>
            <span className="haStatValue">{s.value}</span>
            <span className={`haStatChange ${s.changeType}`}>{s.change}</span>
          </div>
        );
      })}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Rank badge helper
// ─────────────────────────────────────────────────────────────
function rankClass(rank: number) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "";
}

// ─────────────────────────────────────────────────────────────
// Column 2: Top Holders
// ─────────────────────────────────────────────────────────────
function TopHoldersPanel() {
  const router = useRouter();

  return (
    <div className="haPanel">
      <div className="haPanelHeader">
        <h2 className="haPanelTitle">
          <Users size={14} />
          Top Holders
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="haSyncBadge">
            <span className="haSyncDot" />
            Syncing…
          </span>
          <button className="haPanelLink" type="button">
            View All <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <table className="haHolderTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Wallet</th>
            <th>Balance</th>
            <th>Value</th>
            <th>% Supply</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {topHolders.map((row) => (
            <tr
              key={row.wallet}
              className="haHolderRow"
              onClick={() => router.push(`/wallet/${row.wallet}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  router.push(`/wallet/${row.wallet}`);
                }
              }}
            >
              <td>
                <span className={`haRank ${rankClass(row.rank)}`}>
                  {row.rank}
                </span>
              </td>
              <td>
                <a
                  className="haWalletAddr"
                  href={`/wallet/${row.wallet}`}
                  onClick={(e) => e.stopPropagation()}
                  title={row.wallet}
                >
                  {row.wallet}
                </a>
              </td>
              <td>
                <span className="haBalancePrimary">{row.balance}</span>
              </td>
              <td style={{ color: "var(--text)", fontWeight: 700 }}>
                {row.value}
              </td>
              <td>
                <span className="haPctSupply">{row.pctSupply}</span>
              </td>
              <td>
                <span
                  className={`haTypeBadge ${row.type.toLowerCase()}`}
                >
                  {row.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Column 3: Whale Movements
// ─────────────────────────────────────────────────────────────
function WhaleMovementsPanel() {
  const router = useRouter();

  return (
    <div className="haPanel">
      <div className="haPanelHeader">
        <h2 className="haPanelTitle">
          <Zap size={14} />
          Whale Movements (24H)
        </h2>
      </div>

      <div className="haMovements">
        {whaleMovements.map((mv) => {
          const isBuy = mv.action === "BUY";
          return (
            <div
              key={mv.id}
              className={`haMovement ${isBuy ? "haMovementBuy" : "haMovementSell"}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/wallet/${mv.wallet}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  router.push(`/wallet/${mv.wallet}`);
                }
              }}
            >
              <span
                className={`haMovementBadge ${isBuy ? "buy" : "sell"}`}
              >
                {mv.action}
              </span>
              <span className="haMovementTime">{mv.timeAgo}</span>
              <a
                className="haMovementWallet"
                href={`/wallet/${mv.wallet}`}
                onClick={(e) => e.stopPropagation()}
                title={mv.wallet}
              >
                {mv.wallet}
              </a>
              <div className="haMovementAmounts">
                <span
                  className={`haMovementUsd ${isBuy ? "pos" : "neg"}`}
                >
                  {mv.usd}
                </span>
                <span className="haMovementTokens">{mv.tokens}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
export function HolderAnalysisPage() {
  return (
    <div className="appShell" style={{ minHeight: "100vh" }}>
      <TopNavbar />

      <div className="haShell">
        <HaSidebar />

        <main className="haMain" role="main" aria-label="Holder Analysis">
          {/* Page header */}
          <div className="haHeader">
            <div className="haHeaderLeft">
              <h1 className="haTitle">Holder Analysis</h1>
              <p className="haSubtitle">
                Track whale wallets, holder distribution, and growth trends
              </p>
            </div>

            {/* Token selector */}
            <button className="haTokenSelector" type="button" aria-label="Select token">
              <span className="haTokenDot" />
              BRETT
              <ChevronDown size={15} />
            </button>
          </div>

          {/* Info banner */}
          <div className="haBanner" role="alert">
            <Info size={15} />
            <span className="haBannerText">
              <strong>Holder data requires on-chain indexing</strong> — connect
              a full-node RPC to enable live holder tracking. Currently showing
              estimated data.
            </span>
          </div>

          {/* Stats strip */}
          <StatsStrip />

          {/* 3-column grid */}
          <div className="haGrid">
            <DistributionPanel />
            <TopHoldersPanel />
            <WhaleMovementsPanel />
          </div>

          {/* Holder growth chart */}
          <HolderGrowthChart />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default HolderAnalysisPage;
