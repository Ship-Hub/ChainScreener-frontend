"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Filter,
  Gem,
  Hexagon,
  KeyRound,
  Layers,
  Lock,
  Radar,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import "../app/smart-money/smart-money.css";
import { MobileBottomNav } from "./MobileBottomNav";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Timeframe = "1H" | "6H" | "24H" | "7D";

interface FeedItem {
  id: string;
  action: "BUY" | "SELL";
  timeAgo: string;
  walletAddr: string;
  verified: boolean;
  description: string;
  value: string;
  mcap?: string;
  tokenCount?: string;
  roi?: string;
}

interface AccumulatedToken {
  ticker: string;
  dotColor: string;
  smartWallets: number;
  netFlow: string;
  signal: number;
}

interface DistributedToken {
  ticker: string;
  dotColor: string;
  smartWallets: number;
  netFlow: string;
  signal: number;
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  roi: string;
  winRate: string;
  pnl: string;
}

interface EarlyEntry {
  ticker: string;
  wallet: string;
  entryMcap: string;
  currentMcap: string;
  roi: string;
}

interface ConsensusRow {
  ticker: string;
  dotColor: string;
  buyWallets: number;
  sellWallets: number;
  consensus: number;
  strength: "Very Strong" | "Strong" | "Moderate";
}

// ─────────────────────────────────────────────────────────────
// API response types (matching smartMoneyService.ts)
// ─────────────────────────────────────────────────────────────
interface ApiSmFeedItem {
  id: string;
  action: "BUY" | "SELL";
  timeAgo: string;
  walletAddr: string;
  description: string;
  value: string;
  tokenSymbol: string;
  chain: string;
  txHash: string;
  occurredAt: string;
}

interface ApiLeaderEntry {
  rank: number;
  wallet: string;
  score: number;
  totalTrades: number;
  tokensTraded: number;
  volumeUsd: number;
  winRatePct: number;
  realizedPnlUsd: number;
  earlyEntryPct: number;
  profitableTrades: number;
  totalClosedTrades: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

interface ApiFlowToken {
  ticker: string;
  tokenAddress: string;
  chain: string;
  smartWallets: number;
  netFlowUsd: number;
  signal: number;
}

interface ApiConsensusRow {
  ticker: string;
  tokenAddress: string;
  chain: string;
  buyWallets: number;
  sellWallets: number;
  totalWallets: number;
  consensus: number;
  strength: "Very Strong" | "Strong" | "Moderate";
}

interface ApiMetrics {
  totalBuys: number;
  totalSells: number;
  netFlowUsd: number;
  activeSmartWallets: number;
  totalVolumeUsd: number;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function dotColorForSignal(signal: number): string {
  if (signal >= 80) return "green";
  if (signal >= 60) return "cyan";
  if (signal >= 40) return "amber";
  return "red";
}

// ─────────────────────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────────────────────
const navSections = [
  {
    title: "",
    items: [
      { label: "Radar",         icon: Radar,            route: "/" },
      { label: "Launches",      icon: Activity,         route: "/launches" },
      { label: "Watchlist",     icon: Star,             route: "/watchlist" },
      { label: "Opportunities", icon: Gem,              route: "/opportunities" },
      { label: "Alerts",        icon: Bell,             route: "/alerts" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money",    icon: Zap,       route: "/smart-money", active: true },
      { label: "Wallet Explorer",icon: Wallet,    route: "/wallet-explorer" },
      { label: "Holder Analysis",icon: Crosshair, route: "/holder-analysis" },
      { label: "Risk Scanner",   icon: Shield,    route: "/risk-scanner" },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools",          icon: Layers,          route: "/dex-pools" },
      { label: "Liquidity Locks",    icon: Lock,            route: "/liquidity-locks" },
      { label: "Contract Analyzer",  icon: Database,        route: "/contract-analyzer" },
      { label: "Top Gainers",        icon: TrendingUp,      route: "/top-gainers" },
      { label: "Top Volume",         icon: CircleDollarSign,route: "/top-volume" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings",      icon: Settings, route: "/settings" },
      { label: "API Access",    icon: KeyRound, route: "/api-access" },
      { label: "Documentation", icon: BookOpen, route: "/docs" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────
function TokenLogo({ label, tone, large = false }: { label: string; tone: string; large?: boolean }) {
  return (
    <span className={`tokenLogo ${tone} ${large ? "large" : ""}`}>
      <Hexagon size={large ? 24 : 15} />
      <b>{label.slice(0, 2).toUpperCase()}</b>
    </span>
  );
}

function MiniSparklineGreen({ points }: { points: string }) {
  return (
    <svg className="smMetricSparkline green" viewBox="0 0 68 26" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function MiniSparklineRed({ points }: { points: string }) {
  return (
    <svg className="smMetricSparkline red" viewBox="0 0 68 26" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function MiniSparklineCyan({ points }: { points: string }) {
  return (
    <svg className="smMetricSparkline cyan" viewBox="0 0 68 26" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function MiniSparklineViolet({ points }: { points: string }) {
  return (
    <svg className="smMetricSparkline violet" viewBox="0 0 68 26" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function LbSparkline() {
  return (
    <svg className="smLbSparkline" viewBox="0 0 54 22" aria-hidden="true">
      <polyline points="2,18 10,14 20,16 30,10 40,12 50,5 54,7" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Flow Map SVG
// ─────────────────────────────────────────────────────────────
function FlowMap({ accumulated, distributed }: { accumulated: ApiFlowToken[]; distributed: ApiFlowToken[] }) {
  const cx = 240;
  const cy = 190;

  // Combine real data: up to 5 inflows + 3 outflows, positioned radially
  const combined = [
    ...accumulated.slice(0, 5).map((t) => ({ ...t, isInflow: true })),
    ...distributed.slice(0, 3).map((t) => ({ ...t, isInflow: false })),
  ];

  if (combined.length === 0) {
    return (
      <div className="smFlowMapWrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <span style={{ color: "var(--faint)", fontSize: 13 }}>No flow data yet — run the indexer</span>
      </div>
    );
  }

  // Compute radial positions + bubble sizes from real flow amounts
  const bubbles = combined.map((token, i) => {
    const angle = (i / combined.length) * 2 * Math.PI - Math.PI / 2;
    const dist = 120;
    const bx = Math.round(cx + Math.cos(angle) * dist);
    const by = Math.round(cy + Math.sin(angle) * dist);
    const r = Math.max(20, Math.min(54, 20 + Math.sqrt(Math.abs(token.netFlowUsd)) / 25));
    const fill = token.isInflow ? "oklch(0.2 0.1 151)" : "oklch(0.18 0.08 25)";
    const stroke = token.isInflow ? "oklch(0.65 0.22 151)" : "oklch(0.62 0.2 25)";
    const flowFmt = Math.abs(token.netFlowUsd) >= 1000
      ? `${token.isInflow ? "+" : "-"}$${(Math.abs(token.netFlowUsd) / 1000).toFixed(0)}K`
      : `${token.isInflow ? "+" : "-"}$${Math.abs(token.netFlowUsd).toFixed(0)}`;
    return {
      id: token.ticker,
      cx: bx,
      cy: by,
      r: Math.round(r),
      fill,
      stroke,
      label1: token.ticker,
      label2: `${token.smartWallets} wallet${token.smartWallets !== 1 ? "s" : ""}`,
      label3: flowFmt,
      score: String(token.signal),
      isInflow: token.isInflow,
    };
  });

  // Flow lines from core to each token
  const lines = bubbles.map((b) => ({
    x1: cx, y1: cy, x2: b.cx, y2: b.cy, inflow: b.isInflow, id: b.id,
  }));

  return (
    <div className="smFlowMapWrap">
      <svg className="smFlowMapSvg" viewBox="0 0 480 360" aria-label="Smart money flow map">
        <defs>
          <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.65 0.22 151 / 0.55)" />
          </marker>
          <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.62 0.2 25 / 0.55)" />
          </marker>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.82 0.18 210)" stopOpacity="0.9" />
            <stop offset="70%" stopColor="oklch(0.55 0.12 210)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.18 0.05 210)" stopOpacity="0" />
          </radialGradient>
          {bubbles.map((b) => (
            <radialGradient key={`grad-${b.id}`} id={`grad-${b.id}`} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor={b.stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={b.fill} stopOpacity="0.95" />
            </radialGradient>
          ))}
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background grid dots */}
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 10 }, (_, col) => (
            <circle
              key={`dot-${row}-${col}`}
              cx={col * 53 + 10}
              cy={row * 46 + 10}
              r={1}
              fill="oklch(0.5 0.04 255 / 0.18)"
            />
          ))
        )}

        {/* Flow lines */}
        {lines.map((l) => (
          <line
            key={`line-${l.id}`}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            className={l.inflow ? "smFlowLine" : "smFlowLineRed"}
            markerEnd={l.inflow ? "url(#arrowGreen)" : "url(#arrowRed)"}
          />
        ))}

        {/* Core glow */}
        <circle cx={cx} cy={cy} r={36} fill="url(#coreGrad)" opacity="0.6" />
        <circle cx={cx} cy={cy} r={18} fill="oklch(0.78 0.17 210 / 0.9)" />
        <circle cx={cx} cy={cy} r={9}  fill="white" opacity="0.9" />

        {/* Token bubbles */}
        {bubbles.map((b) => (
          <g key={b.id} className="smBubble">
            {/* Glow ring */}
            <circle
              cx={b.cx} cy={b.cy} r={b.r + 6}
              fill="none"
              stroke={b.stroke}
              strokeWidth="1"
              opacity="0.25"
            />
            {/* Body */}
            <circle
              cx={b.cx} cy={b.cy} r={b.r}
              fill={`url(#grad-${b.id})`}
              stroke={b.stroke}
              strokeWidth="1.2"
              opacity="0.9"
            />
            {/* Score badge */}
            <circle cx={b.cx + b.r - 9} cy={b.cy - b.r + 9} r={11}
              fill={b.isInflow ? "oklch(0.22 0.08 151)" : "oklch(0.22 0.08 25)"}
              stroke={b.stroke} strokeWidth="0.8" />
            <text
              x={b.cx + b.r - 9} y={b.cy - b.r + 13}
              textAnchor="middle"
              fontSize="8"
              fontWeight="800"
              fill={b.isInflow ? "oklch(0.78 0.19 151)" : "oklch(0.72 0.2 25)"}
            >{b.score}</text>

            {/* Labels */}
            <text className="smBubbleLabel" x={b.cx} y={b.cy - 9}>{b.label1}</text>
            <text className="smBubbleSubLabel" x={b.cx} y={b.cy + 4}>{b.label2}</text>
            <text
              className="smBubbleSubLabel"
              x={b.cx} y={b.cy + 15}
              fill={b.isInflow ? "oklch(0.72 0.18 151)" : "oklch(0.7 0.18 25)"}
              fontWeight="700"
            >{b.label3}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top Navbar
// ─────────────────────────────────────────────────────────────
function TopNavbar() {
  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb"><Radar size={22} /></span>
        <div>
          <strong>Chain Screener</strong>
          <span>Smart Money</span>
        </div>
      </div>
      <label className="commandSearch">
        <Search size={18} />
        <input placeholder="Search token, wallet, contract, or address..." />
        <kbd>⌘ K</kbd>
      </label>
      <div className="topActions">
        <button className="topButton" type="button"><Bell size={16} /> Alerts <span>12</span></button>
        <button className="topButton" type="button"><Star size={16} /> Watchlist</button>
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
function SmSidebar() {
  const router = useRouter();
  return (
    <aside className="smSidebar">
      <nav aria-label="Smart Money navigation">
        {navSections.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? <span className="navSectionTitle">{section.title}</span> : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = Boolean(item.active);
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
        <strong><Gem size={16} /> Go Pro</strong>
        <p>Advanced analytics, real-time alerts, and unlimited scans.</p>
        <button type="button">Upgrade Now <ArrowRight size={15} /></button>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Metric Cards
// ─────────────────────────────────────────────────────────────
function MetricCards({ metrics }: { metrics: ApiMetrics | null }) {
  const cards = [
    {
      icon: TrendingUp,
      iconTone: "green",
      label: "Smart Wallet Buys",
      value: metrics ? metrics.totalBuys.toLocaleString() : "—",
      change: metrics ? `${fmtUsd(metrics.netFlowUsd > 0 ? metrics.netFlowUsd : 0)} net in` : "Loading…",
      changeType: "positive" as const,
      sparkline: <MiniSparklineGreen points="2,22 10,18 20,14 30,16 40,10 50,12 60,7 68,4" />,
    },
    {
      icon: TrendingDown,
      iconTone: "red",
      label: "Smart Wallet Sells",
      value: metrics ? metrics.totalSells.toLocaleString() : "—",
      change: metrics ? `${fmtUsd(metrics.netFlowUsd < 0 ? -metrics.netFlowUsd : 0)} net out` : "Loading…",
      changeType: "negative" as const,
      sparkline: <MiniSparklineRed points="2,4 10,8 20,10 30,6 40,14 50,12 60,18 68,22" />,
    },
    {
      icon: Activity,
      iconTone: "cyan",
      label: "Net Smart Money Flow",
      value: metrics ? (metrics.netFlowUsd >= 0 ? "+" : "") + fmtUsd(metrics.netFlowUsd) : "—",
      change: metrics ? (metrics.netFlowUsd >= 0 ? "Net positive" : "Net negative") : "Loading…",
      changeType: "neutral" as const,
      sparkline: <MiniSparklineCyan points="2,14 10,16 20,12 30,10 40,14 50,10 60,8 68,6" />,
    },
    {
      icon: Wallet,
      iconTone: "cyan",
      label: "Active Smart Wallets",
      value: metrics ? metrics.activeSmartWallets.toLocaleString() : "—",
      change: "In selected timeframe",
      changeType: "positive" as const,
      sparkline: <MiniSparklineCyan points="2,20 10,16 20,18 30,12 40,14 50,10 60,8 68,5" />,
    },
    {
      icon: Sparkles,
      iconTone: "violet",
      label: "Total Swaps Tracked",
      value: metrics ? (metrics.totalBuys + metrics.totalSells).toLocaleString() : "—",
      change: "Buys + Sells",
      changeType: "positive" as const,
      sparkline: <MiniSparklineViolet points="2,22 10,18 20,20 30,14 40,16 50,10 60,8 68,4" />,
    },
    {
      icon: CircleDollarSign,
      iconTone: "green",
      label: "Total Volume Tracked",
      value: metrics ? fmtUsd(metrics.totalVolumeUsd) : "—",
      change: "At current prices",
      changeType: "positive" as const,
      sparkline: <MiniSparklineGreen points="2,22 10,20 20,16 30,14 40,12 50,9 60,6 68,3" />,
    },
  ] as const;

  return (
    <div className="smMetricGrid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className="smMetricCard" key={card.label}>
            <div className="smMetricTop">
              <div className={`smMetricIcon ${card.iconTone}`}>
                <Icon size={16} />
              </div>
            </div>
            <span className="smMetricLabel">{card.label}</span>
            <span className="smMetricValue">{card.value}</span>
            <span className={`smMetricChange ${card.changeType}`}>{card.change}</span>
            {card.sparkline}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────────────────────
function ActivityFeed({
  items,
  loading,
  onRefresh,
  onClear,
}: {
  items: ApiSmFeedItem[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [expanded, setExpanded] = useState(false);

  const filtered = tab === "ALL" ? items : items.filter((i) => i.action === tab);
  const displayed = expanded ? filtered : filtered.slice(0, 8);

  return (
    <div className="smPanel">
      <h2 className="smPanelTitle">
        <Zap size={15} />
        Smart Money Activity Feed
      </h2>

      <div className="smFeedFilter">
        <button className={`smFeedTab ${tab === "ALL" ? "active" : ""}`} type="button" onClick={() => setTab("ALL")}>All</button>
        <button className={`smFeedTab ${tab === "BUY" ? "active" : ""}`} type="button" onClick={() => setTab("BUY")}>Buys</button>
        <button className={`smFeedTab ${tab === "SELL" ? "active" : ""}`} type="button" onClick={() => setTab("SELL")}>Sells</button>
        <button className="smFeedIconBtn" type="button" aria-label="Refresh feed" title="Refresh" onClick={onRefresh}>
          <RefreshCw size={13} />
        </button>
        <button className="smFeedIconBtn" type="button" aria-label="Filter feed" title="Filter">
          <Filter size={13} />
        </button>
        <button className="smFeedIconBtn" type="button" aria-label="Clear feed" title="Clear" onClick={onClear}>
          <X size={13} />
        </button>
      </div>

      <div className="smFeedList">
        {loading ? (
          <div style={{ color: "var(--faint)", padding: "12px 0", textAlign: "center" }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ color: "var(--faint)", padding: "12px 0", textAlign: "center" }}>
            {items.length === 0 ? "No activity yet — run the indexer to populate" : "No items match this filter"}
          </div>
        ) : displayed.map((item) => (
          <div className="smFeedItem" key={item.id}>
            <div className="smFeedItemRow1">
              <span className={`smBadge ${item.action.toLowerCase()}`}>{item.action}</span>
              <span className="smFeedTime">{item.timeAgo}</span>
              <div className="smWalletAvatar">{item.walletAddr.slice(2, 4).toUpperCase()}</div>
              <a
                className="smWalletAddr"
                href={`/wallet/${item.walletAddr}`}
                onClick={(e) => { e.preventDefault(); router.push(`/wallet/${item.walletAddr}`); }}
                title={item.walletAddr}
              >
                {item.walletAddr}
              </a>
              <BadgeCheck size={14} className="smVerified" aria-label="Tracked wallet" />
              <span className="smFeedValue">{item.value}</span>
            </div>
            <div className="smFeedItemRow2">
              <span className="smFeedAction">{item.description}</span>
              <span className="smFeedMeta">{item.chain.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 8 && (
        <button className="smPanelLink" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse" : `View Full Feed (${filtered.length})`} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Flow Map Panel
// ─────────────────────────────────────────────────────────────
function FlowMapPanel({ accumulated, distributed }: { accumulated: ApiFlowToken[]; distributed: ApiFlowToken[] }) {
  const [showInfo, setShowInfo] = useState(false);

  const totalInflow = accumulated.reduce((s, t) => s + t.netFlowUsd, 0);
  const totalOutflow = distributed.reduce((s, t) => s + Math.abs(t.netFlowUsd), 0);
  const netFlow = totalInflow - totalOutflow;
  const netFlowFmt = Math.abs(netFlow) >= 1_000_000
    ? `${netFlow >= 0 ? "+" : "-"}$${(Math.abs(netFlow) / 1_000_000).toFixed(2)}M`
    : Math.abs(netFlow) >= 1000
      ? `${netFlow >= 0 ? "+" : "-"}$${(Math.abs(netFlow) / 1000).toFixed(0)}K`
      : `${netFlow >= 0 ? "+" : "-"}$${Math.abs(netFlow).toFixed(0)}`;

  const BAR_MAX = 500_000;
  const markerPct = Math.min(100, Math.max(0, ((netFlow + BAR_MAX) / (2 * BAR_MAX)) * 100));

  return (
    <div className="smPanel">
      <h2 className="smPanelTitle">
        <Activity size={15} />
        Smart Money Flow Map (24H)
      </h2>

      <FlowMap accumulated={accumulated} distributed={distributed} />

      <div className="smFlowLegend">
        <span className="smFlowLegendItem">
          <span className="smFlowLegendDot green" />
          Net Inflow
        </span>
        <span className="smFlowLegendItem">
          <span className="smFlowLegendDot red" />
          Net Outflow
        </span>
        <span className="smFlowLegendItem">
          <span className="smFlowLegendDot gray" />
          Neutral
        </span>
      </div>

      <div className="smFlowBarWrap">
        <div className="smFlowBarLabel">
          <span>-$500K</span>
          <span>0</span>
          <span>+$500K</span>
        </div>
        <div className="smFlowBar">
          <div className="smFlowBarMarker" style={{ left: `${markerPct}%` }} />
        </div>
        <div className="smFlowBarBottom">
          <span className="smFlowBarCurrent">Net Flow: {netFlowFmt}</span>
          <button className="smHowItWorks" type="button" onClick={() => setShowInfo((v) => !v)}>
            How it works?
          </button>
        </div>
        {showInfo && (
          <div style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 8,
            background: "oklch(0.18 0.04 255 / 0.9)", border: "1px solid oklch(0.32 0.06 255 / 0.4)",
            fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
          }}>
            The bar shows net USD flow (smart wallet buys minus sells) over the selected timeframe, clamped to ±$500K. The marker moves right for net inflow and left for net outflow.
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              style={{ float: "right", background: "none", border: "none", color: "var(--faint)", cursor: "pointer" }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Accumulated / Distributed Tables
// ─────────────────────────────────────────────────────────────
function AccumulatedDistributed({ accumulated, distributed }: { accumulated: ApiFlowToken[]; distributed: ApiFlowToken[] }) {
  const [accExpanded, setAccExpanded] = useState(false);
  const [distExpanded, setDistExpanded] = useState(false);
  const PREVIEW = 5;
  const displayedAcc = accExpanded ? accumulated : accumulated.slice(0, PREVIEW);
  const displayedDist = distExpanded ? distributed : distributed.slice(0, PREVIEW);

  return (
    <div className="smPanel">
      {/* Most Accumulated */}
      <h2 className="smPanelTitle">
        <TrendingUp size={15} />
        Most Accumulated
      </h2>
      <table className="smTable">
        <thead>
          <tr>
            <th>Token</th>
            <th>Smart Wallets</th>
            <th>Net Flow (24H)</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {displayedAcc.length === 0 ? (
            <tr><td colSpan={4} style={{ color: "var(--faint)", textAlign: "center" }}>No data yet</td></tr>
          ) : displayedAcc.map((row) => (
            <tr key={`${row.chain}:${row.tokenAddress}`}>
              <td>
                <span className="smTokenTicker">
                  <span className={`smTokenDot ${dotColorForSignal(row.signal)}`} />
                  {row.ticker}
                </span>
              </td>
              <td>{row.smartWallets}</td>
              <td><span className="smNetFlowPos">+{fmtUsd(row.netFlowUsd)}</span></td>
              <td>
                <span className={`smSignalBadge ${row.signal >= 80 ? "high" : row.signal >= 60 ? "medium" : "low"}`}>
                  {row.signal}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {accumulated.length > PREVIEW && (
        <button className="smPanelLink" type="button" onClick={() => setAccExpanded((v) => !v)}>
          {accExpanded ? "Collapse" : `View All (${accumulated.length})`} <ArrowRight size={14} />
        </button>
      )}

      <div className="smTableDivider" />

      {/* Most Distributed */}
      <div className="smTableSubtitle">
        <TrendingDown size={14} />
        Most Distributed
      </div>
      <table className="smTable">
        <thead>
          <tr>
            <th>Token</th>
            <th>Smart Wallets</th>
            <th>Net Flow (24H)</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {displayedDist.length === 0 ? (
            <tr><td colSpan={4} style={{ color: "var(--faint)", textAlign: "center" }}>No data yet</td></tr>
          ) : displayedDist.map((row) => (
            <tr key={`${row.chain}:${row.tokenAddress}`}>
              <td>
                <span className="smTokenTicker">
                  <span className={`smTokenDot red`} />
                  {row.ticker}
                </span>
              </td>
              <td>{row.smartWallets}</td>
              <td><span className="smNetFlowNeg">{fmtUsd(row.netFlowUsd)}</span></td>
              <td>
                <span className={`smSignalBadge ${row.signal >= 50 ? "medium" : "low"}`}>
                  {row.signal}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {distributed.length > PREVIEW && (
        <button className="smPanelLink" type="button" onClick={() => setDistExpanded((v) => !v)}>
          {distExpanded ? "Collapse" : `View All (${distributed.length})`} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────
function Leaderboard({ entries, loading }: { entries: ApiLeaderEntry[]; loading: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 8;
  const displayed = expanded ? entries : entries.slice(0, PREVIEW);
  const rankClass = (rank: number) =>
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

  return (
    <div className="smPanel">
      <h2 className="smPanelTitle">
        <Star size={15} />
        Smart Wallet Leaderboard
      </h2>
      <table className="smTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Wallet</th>
            <th>Score</th>
            <th>Win Rate</th>
            <th>Realized P&L</th>
            <th>Early Entry</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ color: "var(--faint)", textAlign: "center" }}>Loading…</td></tr>
          ) : displayed.length === 0 ? (
            <tr><td colSpan={6} style={{ color: "var(--faint)", textAlign: "center" }}>No smart wallets yet — run indexer:smart-wallets</td></tr>
          ) : displayed.map((row) => (
            <tr key={row.wallet} onClick={() => router.push(`/wallet/${row.wallet}`)}>
              <td><span className={`smRank ${rankClass(row.rank)}`}>{row.rank}</span></td>
              <td>
                <a
                  className="smWalletAddr"
                  href={`/wallet/${row.wallet}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.wallet}
                </a>
              </td>
              <td><span className="smNetFlowPos">{row.score} / 100</span></td>
              <td>
                <span className={row.totalClosedTrades > 0 ? (row.winRatePct >= 50 ? "smNetFlowPos" : "smNetFlowNeg") : ""}>
                  {row.totalClosedTrades > 0 ? `${row.winRatePct}%` : "—"}
                </span>
              </td>
              <td>
                <span className={row.totalClosedTrades > 0 ? (row.realizedPnlUsd >= 0 ? "smNetFlowPos" : "smNetFlowNeg") : ""}>
                  {row.totalClosedTrades > 0
                    ? `${row.realizedPnlUsd >= 0 ? "+" : ""}${fmtUsd(row.realizedPnlUsd)}`
                    : "—"}
                </span>
              </td>
              <td>{row.earlyEntryPct > 0 ? `${row.earlyEntryPct}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length > PREVIEW && (
        <button className="smPanelLink" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse" : `View Full Leaderboard (${entries.length})`} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Early Entries — wallets with highest early-entry % scores
// ─────────────────────────────────────────────────────────────
function EarlyEntries({ entries }: { entries: ApiLeaderEntry[] }) {
  const router = useRouter();
  // Sort by earlyEntryPct descending, only show wallets that have any early trades
  const sorted = [...entries]
    .filter(e => e.earlyEntryPct > 0 || e.totalTrades > 0)
    .sort((a, b) => b.earlyEntryPct - a.earlyEntryPct)
    .slice(0, 8);

  return (
    <div className="smPanel">
      <h2 className="smPanelTitle">
        <Sparkles size={15} />
        Best Early Entries
      </h2>
      <table className="smTable">
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Early %</th>
            <th>Win Rate</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={4} style={{ color: "var(--faint)", textAlign: "center" }}>No data yet</td></tr>
          ) : sorted.map((row) => (
            <tr key={row.wallet} onClick={() => router.push(`/wallet/${row.wallet}`)}>
              <td>
                <a
                  className="smWalletAddr"
                  href={`/wallet/${row.wallet}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.wallet}
                </a>
              </td>
              <td><span className="smNetFlowPos">{row.earlyEntryPct > 0 ? `${row.earlyEntryPct}%` : "—"}</span></td>
              <td>
                <span className={row.totalClosedTrades > 0 ? (row.winRatePct >= 50 ? "smNetFlowPos" : "smNetFlowNeg") : ""}>
                  {row.totalClosedTrades > 0 ? `${row.winRatePct}%` : "—"}
                </span>
              </td>
              <td><span className="smRoiVal">{row.score}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Consensus Signals
// ─────────────────────────────────────────────────────────────
function ConsensusSignals({ rows }: { rows: ApiConsensusRow[] }) {
  const strengthClass = (s: ApiConsensusRow["strength"]) => {
    if (s === "Very Strong") return "vstrong";
    if (s === "Strong") return "strong";
    return "moderate";
  };
  const barClass = (s: ApiConsensusRow["strength"]) =>
    s === "Moderate" ? "moderate" : "strong";

  return (
    <div className="smPanel">
      <h2 className="smPanelTitle">
        <Shield size={15} />
        Consensus Signals
      </h2>
      <table className="smTable">
        <thead>
          <tr>
            <th>Token</th>
            <th>Buy Wallets</th>
            <th>Sell Wallets</th>
            <th>Consensus</th>
            <th>Strength</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ color: "var(--faint)", textAlign: "center" }}>No consensus data yet</td></tr>
          ) : rows.map((row) => (
            <tr key={`${row.chain}:${row.tokenAddress}`}>
              <td>
                <span className="smTokenTicker">
                  <span className={`smTokenDot ${dotColorForSignal(row.consensus)}`} />
                  {row.ticker}
                </span>
              </td>
              <td><span className="smNetFlowPos">{row.buyWallets}</span></td>
              <td><span className="smNetFlowNeg">{row.sellWallets}</span></td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="smConsensusBar">
                    <div
                      className={`smConsensusBarFill ${barClass(row.strength)}`}
                      style={{ width: `${row.consensus}%` }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{row.consensus}%</span>
                </div>
              </td>
              <td>
                <span className={`smStrengthLabel ${strengthClass(row.strength)}`}>
                  {row.strength}
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
// Alert Ticker
// ─────────────────────────────────────────────────────────────
function AlertTicker({ feedItems }: { feedItems: ApiSmFeedItem[] }) {
  const router = useRouter();
  const tickerItems = feedItems.length > 0 ? [...feedItems, ...feedItems] : [];
  return (
    <div className="smAlertTicker" role="marquee" aria-label="Smart money alerts">
      <div className="smAlertLead">
        <Zap size={14} />
        Smart Money Alerts
      </div>
      <div className="smAlertViewport">
        <div className="smAlertRail">
          {tickerItems.length === 0 ? (
            <span className="smAlertItem" key="empty">
              <span className="smAlertItemDot" />
              Waiting for smart wallet activity…
            </span>
          ) : tickerItems.map((item, idx) => (
            <span className="smAlertItem" key={`${item.id}-${idx}`}>
              <span className="smAlertItemDot" />
              <span>{item.walletAddr}</span>
              {" "}{item.action === "BUY" ? "just bought" : "just sold"}{" "}
              <strong>{item.value}</strong>
              {" "}of <strong>{item.tokenSymbol}</strong>
              {" "}<span style={{ color: "var(--faint)" }}>{item.timeAgo}</span>
            </span>
          ))}
        </div>
      </div>
      <button className="smAlertViewAll" type="button" onClick={() => router.push("/alerts")}>
        View All Alerts <ArrowRight size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
const TIMEFRAME_HOURS: Record<Timeframe, number> = { "1H": 1, "6H": 6, "24H": 24, "7D": 168 };

export function SmartMoneyPage() {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<Timeframe>("24H");
  const timeframes: Timeframe[] = ["1H", "6H", "24H", "7D"];

  const [feed, setFeed] = useState<ApiSmFeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<ApiLeaderEntry[]>([]);
  const [accumulated, setAccumulated] = useState<ApiFlowToken[]>([]);
  const [distributed, setDistributed] = useState<ApiFlowToken[]>([]);
  const [consensus, setConsensus] = useState<ApiConsensusRow[]>([]);
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (tf: Timeframe) => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const h = TIMEFRAME_HOURS[tf];
    setLoading(true);
    try {
      await Promise.all([
        fetch(`${api}/api/smart-money/feed?hours=${h}&limit=20`).then(r => r.json()).then(d => setFeed(d.data ?? [])),
        fetch(`${api}/api/smart-money/leaderboard?limit=20&hours=${h}`).then(r => r.json()).then(d => setLeaderboard(d.data ?? [])),
        fetch(`${api}/api/smart-money/flow?hours=${h}`).then(r => r.json()).then(d => { setAccumulated(d.data?.accumulated ?? []); setDistributed(d.data?.distributed ?? []); }),
        fetch(`${api}/api/smart-money/consensus?hours=${h}`).then(r => r.json()).then(d => setConsensus(d.data ?? [])),
        fetch(`${api}/api/smart-money/metrics?hours=${h}`).then(r => r.json()).then(d => setMetrics(d.data ?? null)),
      ]);
    } catch {
      // API unreachable — keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(timeframe); }, [timeframe, fetchData]);

  return (
    <div
      className="appShell"
      style={{ minHeight: "100vh" }}
    >
      <TopNavbar />

      <div className="smGrid">
        <SmSidebar />

        <main className="smMain" role="main" aria-label="Smart Money Command Center">
          {/* Page Header */}
          <div className="smPageHeader">
            <div>
              <h1 className="smPageTitle">Smart Money Command Center</h1>
              <p className="smPageSubtitle">
                Real-time tracking of smart money movements and market signals
              </p>
            </div>
            <div className="smHeaderRight">
              <div className="smTimeframeGroup">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    className={`smTimeframeBtn ${timeframe === tf ? "active" : ""}`}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    aria-pressed={timeframe === tf}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <button className="smGearBtn" type="button" aria-label="Settings" onClick={() => router.push("/settings")}>
                <Settings size={16} />
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <MetricCards metrics={metrics} />

          {/* Main 3-column section */}
          <div className="smContentGrid">
            <ActivityFeed
              items={feed}
              loading={loading}
              onRefresh={() => fetchData(timeframe)}
              onClear={() => setFeed([])}
            />
            <FlowMapPanel accumulated={accumulated} distributed={distributed} />
            <AccumulatedDistributed accumulated={accumulated} distributed={distributed} />
          </div>

          {/* Bottom 3-column section */}
          <div className="smBottomGrid">
            <Leaderboard entries={leaderboard} loading={loading} />
            <EarlyEntries entries={leaderboard} />
            <ConsensusSignals rows={consensus} />
          </div>
        </main>
      </div>

      {/* Fixed alert ticker */}
      <AlertTicker feedItems={feed} />
      <MobileBottomNav />
    </div>
  );
}

export default SmartMoneyPage;
