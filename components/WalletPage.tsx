"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MobileBottomNav } from "./MobileBottomNav";
import {
  ArrowLeft,
  Copy,
  Check,
  Star,
  Bell,
  ExternalLink,
  TrendingUp,
  Wallet,
  Zap,
  Shield,
  Crosshair,
  Layers,
  Lock,
  Database,
  Settings,
  KeyRound,
  BookOpen,
  Gem,
  Activity,
  Radar,
  CircleDollarSign,
  MoreHorizontal,
} from "lucide-react";
import dynamic from "next/dynamic";

const WalletEquityChart = dynamic(() => import("./charts/WalletEquityChart"), {
  ssr: false,
  loading: () => <div style={{ height: 220, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12 }}>Loading chart…</div>,
});

// ── API types ──────────────────────────────────────────────────────────────────

type WalletTrade = {
  chain: string;
  dexName: string;
  txHash: string;
  blockNumber: number;
  occurredAt: string;
  side: "buy" | "sell";
  tokenAddress: string;
  tokenSymbol: string;
  tokenAmount: number;
  priceUsd: number;
  valueUsd: number;
  poolAddress: string | null;
};

type WalletStats = {
  address: string;
  totalTrades: number;
  tokenCount: number;
  chainCount: number;
  totalVolumeUsd: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  score: number;
  winRatePct: number;
  realizedPnlUsd: number;
  earlyEntryPct: number;
  profitableTrades: number;
  totalClosedTrades: number;
};

type WalletHolding = {
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
  netAmount: number;
  priceUsd: number;
  valueUsd: number;
  priceChange24h: number;
};

type FundingEdge = {
  chain: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  amountRaw: string;
  transferCount: number;
  confidence: number;
  firstSeenBlock: number;
  lastSeenBlock: number;
};

type FundingAnalysis = {
  address: string;
  incoming: FundingEdge[];
  outgoing: FundingEdge[];
  likelyFunders: FundingEdge[];
  likelyFundedWallets: FundingEdge[];
};

type GraphNode = { id: string; label: string; type: string; weight: number };
type GraphEdge = { from: string; to: string; type: string; weight: number; confidence?: number };
type WalletGraphData = { address: string; nodes: GraphNode[]; edges: GraphEdge[] };

// ── Static display helpers ─────────────────────────────────────────────────────

const scoreBars = [
  { label: "Activity", value: 0 },
  { label: "Diversity", value: 0 },
  { label: "Multi-chain", value: 0 },
  { label: "Volume", value: 0 },
  { label: "Consistency", value: 0 },
];

const GRAPH_ANGLES = [0, 60, 120, 180, 240, 300];

const TIMEFRAME_DAYS: Record<string, number> = {
  "7D": 7, "30D": 30, "90D": 90, "180D": 180, "1Y": 365, "All": Infinity,
};

function graphNodeEmoji(type: string): string {
  if (type === "funding") return "💸";
  if (type === "co-trader") return "🤝";
  return "🦊";
}

const copySimRows = [
  { period: "30 Days", ret: "—", spark: [10, 18, 14, 22, 28, 25, 42] },
  { period: "90 Days", ret: "—", spark: [8, 20, 15, 45, 38, 72, 90, 118] },
  { period: "180 Days", ret: "—", spark: [5, 30, 22, 65, 55, 110, 175, 250, 294] },
];

const similarWallets = [
  { addr: "0x3f44...bc12", emoji: "🦅", sim: "—", ret: "—", color: "linear-gradient(135deg,#1a2a4a,#1a3a2a)" },
  { addr: "0x7c90...4e3f", emoji: "🐂", sim: "—", ret: "—", color: "linear-gradient(135deg,#2a1a4a,#1a1a3a)" },
  { addr: "0xa2b5...77d1", emoji: "🚀", sim: "—", ret: "—", color: "linear-gradient(135deg,#1a3a1a,#1a2a1a)" },
];

// ── Formatting helpers ─────────────────────────────────────────────────────────

function explorerRoot(chain: string): string {
  if (chain === "base") return "https://basescan.org";
  if (chain === "eth") return "https://etherscan.io";
  return "https://bscscan.com";
}

function explorerTx(chain: string, hash: string): string {
  return `${explorerRoot(chain)}/tx/${hash}`;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
}

function fmtTokenAmount(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(4);
}

function fmtPrice(p: number): string {
  if (p === 0) return "—";
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(4)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function MiniSparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 52;
  const h = 22;
  const pad = 2;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="wpMiniSparkline" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} />
    </svg>
  );
}


function ScoreGauge({ score }: { score: number }) {
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  // Draw a 270-degree arc (from 135deg to 405deg)
  const arcLen = (score / 100) * circumference * 0.75;
  const gapLen = circumference - arcLen;
  // Start at -135deg (bottom left), rotate -225deg
  return (
    <svg viewBox="0 0 88 88" style={{ transform: "rotate(-225deg)" }}>
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="oklch(0.23 0.03 255)"
        strokeWidth="6"
        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25 + 1}`}
        strokeLinecap="round"
      />
      {/* Fill */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="oklch(0.76 0.19 151)"
        strokeWidth="6"
        strokeDasharray={`${arcLen} ${gapLen}`}
        strokeLinecap="round"
        style={{
          filter: "drop-shadow(0 0 6px oklch(0.76 0.19 151 / 0.7))",
        }}
      />
    </svg>
  );
}

// ── Nav items config ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: <Radar size={15} />, label: "Radar" },
  { icon: <Zap size={15} />, label: "Launches" },
  { icon: <Star size={15} />, label: "Watchlist" },
  { icon: <TrendingUp size={15} />, label: "Opportunities" },
  { icon: <Bell size={15} />, label: "Alerts" },
];

const INTELLIGENCE_ITEMS = [
  { icon: <Activity size={15} />, label: "Smart Money" },
  { icon: <Wallet size={15} />, label: "Wallet Explorer", active: true },
  { icon: <Layers size={15} />, label: "Holder Analysis" },
  { icon: <Shield size={15} />, label: "Risk Scanner" },
];

const TOOLS_ITEMS = [
  { icon: <Database size={15} />, label: "DEX Pools" },
  { icon: <Lock size={15} />, label: "Liquidity Locks" },
  { icon: <Crosshair size={15} />, label: "Contract Analyzer" },
  { icon: <TrendingUp size={15} />, label: "Top Gainers" },
  { icon: <CircleDollarSign size={15} />, label: "Top Volume" },
];

const SETTINGS_ITEMS = [
  { icon: <Settings size={15} />, label: "Settings" },
  { icon: <KeyRound size={15} />, label: "API Access" },
  { icon: <BookOpen size={15} />, label: "Documentation" },
];

// ── Main component ────────────────────────────────────────────────────────────

interface WalletPageProps {
  address: string;
}

export default function WalletPage({ address }: WalletPageProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState("All");
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [holdings, setHoldings] = useState<WalletHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState<FundingAnalysis | null>(null);
  const [graph, setGraph] = useState<WalletGraphData | null>(null);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "0x7c1e...8a2b";

  useEffect(() => {
    if (!address) return;
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    setLoading(true);
    Promise.all([
      fetch(`${api}/api/wallets/${address}/trades?limit=50`).then(r => r.json()).then(d => setTrades(d.data ?? [])),
      fetch(`${api}/api/wallets/${address}/stats`).then(r => r.json()).then(d => setStats(d.data ?? null)),
      fetch(`${api}/api/wallets/${address}/holdings`).then(r => r.json()).then(d => setHoldings(d.data ?? [])),
      fetch(`${api}/api/wallets/${address}/funding`).then(r => r.json()).then(d => setFunding(d.data ?? null)).catch(() => {}),
      fetch(`${api}/api/wallets/${address}/graph`).then(r => r.json()).then(d => setGraph(d.data ?? null)).catch(() => {}),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [address]);

  const handleNavClick = useCallback((label: string) => {
    if (label === "Radar")           { router.push("/");                        return; }
    if (label === "Launches")        { router.push("/launches");                return; }
    if (label === "Smart Money")     { router.push("/smart-money");             return; }
    if (label === "Top Gainers")     { router.push("/top-gainers");             return; }
    if (label === "Top Volume")      { router.push("/top-gainers?sort=volume"); return; }
    if (label === "Holder Analysis") { router.push("/holder-analysis");         return; }
    if (label === "Risk Scanner")    { router.push("/risk-scanner");            return; }
    if (label === "Settings")        { router.push("/settings");                return; }
    // Wallet Explorer = current page; others coming soon
  }, [router]);

  // Filter trades by selected timeframe before building equity curve
  const filteredTrades = useMemo(() => {
    const days = TIMEFRAME_DAYS[activeTimeframe] ?? Infinity;
    if (!isFinite(days)) return trades;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return trades.filter(t => new Date(t.occurredAt).getTime() >= cutoff);
  }, [trades, activeTimeframe]);

  // Derive equity curve from cumulative trade volumes over filtered time window
  const equityData = useMemo(() => {
    if (filteredTrades.length === 0) return [{ month: "—", value: 0 }];
    const byMonth = new Map<string, number>();
    for (const t of [...filteredTrades].reverse()) {
      const d = new Date(t.occurredAt);
      const key = `${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + t.valueUsd);
    }
    let running = 0;
    return Array.from(byMonth.entries()).map(([month, v]) => {
      running += v;
      return { month, value: Math.round(running) };
    });
  }, [filteredTrades]);

  const totalVolumeUsd = stats?.totalVolumeUsd ?? filteredTrades.reduce((s, t) => s + t.valueUsd, 0);
  const totalHoldingsUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);

  // Score bars: real quality signals once computeSmartWallets has run
  const liveScoreBars = stats ? [
    { label: "Win Rate",     value: stats.winRatePct },
    { label: "Early Entry",  value: stats.earlyEntryPct },
    { label: "Activity",     value: Math.min(100, Math.floor(Math.log(1 + stats.totalTrades) * 12 + stats.tokenCount * 3 + stats.chainCount * 8)) },
    { label: "Multi-chain",  value: Math.min(100, stats.chainCount * 33) },
    { label: "P&L Score",    value: Math.min(100, Math.max(0, 50 + Math.sign(stats.realizedPnlUsd) * Math.sqrt(Math.abs(stats.realizedPnlUsd)) * 0.5)) },
  ] : scoreBars;

  function handleCopy() {
    navigator.clipboard.writeText(address || shortAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="wpShell">
      {/* ── Sidebar ── */}
      <nav className="wpSidebar">
        <div className="wpNavGroup">
          {NAV_ITEMS.map((item) => (
            <button key={item.label} className="wpNavItem" onClick={() => handleNavClick(item.label)}>
              {item.icon}
              <span className="wpNavItemLabel">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="wpNavDivider" />

        <div className="wpNavSection">Intelligence</div>
        <div className="wpNavGroup">
          {INTELLIGENCE_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`wpNavItem${item.active ? " active" : ""}`}
              onClick={() => handleNavClick(item.label)}
            >
              {item.icon}
              <span className="wpNavItemLabel">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="wpNavDivider" />

        <div className="wpNavSection">Tools</div>
        <div className="wpNavGroup">
          {TOOLS_ITEMS.map((item) => (
            <button key={item.label} className="wpNavItem" onClick={() => handleNavClick(item.label)}>
              {item.icon}
              <span className="wpNavItemLabel">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="wpNavDivider" />

        <div className="wpNavSection">Settings</div>
        <div className="wpNavGroup">
          {SETTINGS_ITEMS.map((item) => (
            <button key={item.label} className="wpNavItem" onClick={() => handleNavClick(item.label)}>
              {item.icon}
              <span className="wpNavItemLabel">{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="wpGoProBox">
          <div className="wpGoProTitle">
            <Gem size={14} />
            Go Pro
          </div>
          <p className="wpGoProDesc">
            Unlock unlimited wallets, real-time alerts, and advanced analytics.
          </p>
          <button className="wpGoProBtn">
            <Zap size={13} />
            Upgrade Now
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="wpMain">
        {/* Top navbar */}
        <header className="wpTopBar">
          <div className="wpBrand">
            <div className="wpBrandOrb">
              <Crosshair size={18} />
            </div>
            <span className="wpBrandName">Chain Screener</span>
          </div>

          <div className="wpSearch">
            <Crosshair size={14} style={{ color: "oklch(0.72 0.028 248)", flexShrink: 0 }} />
            <input placeholder="Search tokens, wallets, contracts…" />
            <kbd className="wpSearchKbd">⌘K</kbd>
          </div>

          <div className="wpTopActions">
            <button className="wpAlertBtn">
              <Bell size={14} />
              Alerts
            </button>
            <button className="wpWatchlistBtn">
              <Star size={14} />
              Watchlist
            </button>
            <div className="wpWalletChip">
              <Wallet size={13} />
              {shortAddress}
            </div>
          </div>
        </header>

        {/* Content row */}
        <div className="wpContentRow">
          {/* Left main scroll area */}
          <main className="wpLeftMain">
            {/* ── Wallet header ── */}
            <div className="wpWalletHeader">
              <a
                href="/"
                className="wpBackLink"
                onClick={(e) => {
                  e.preventDefault();
                  router.push("/");
                }}
              >
                <ArrowLeft size={14} />
                Back to Wallet Explorer
              </a>

              <div className="wpHeaderCardRow">
                {/* Identity block */}
                <div className="wpWalletIdent">
                  <div className="wpWalletIdentTop">
                    <div className="wpAvatar">🦊</div>
                    <div className="wpWalletNameBlock">
                      <div className="wpAddressRow">
                        <span className="wpAddress">{shortAddress}</span>
                        <button className="wpCopyBtn" onClick={handleCopy} title="Copy address">
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        <a
                          href={`${explorerRoot(trades[0]?.chain ?? "eth")}/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wpCopyBtn"
                          title="View on explorer"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      <div className="wpBadgeRow">
                        {(stats?.score ?? 0) >= 50 && <span className="wpBadge cyan">Smart Wallet</span>}
                        {(stats?.score ?? 0) >= 80 && <span className="wpBadge amber">Elite Tier</span>}
                        {(stats?.score ?? 0) > 0 && (stats?.score ?? 0) < 50 && <span className="wpBadge blue">Tracked Wallet</span>}
                        {!stats && <span className="wpBadge blue">Loading…</span>}
                      </div>
                    </div>
                  </div>

                  <div className="wpWalletMetaRow">
                    <div className="wpMetaItem">
                      <span className="wpMetaLabel">First Seen</span>
                      <span className="wpMetaValue">
                        {stats?.firstSeenAt ? new Date(stats.firstSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </span>
                    </div>
                    <div className="wpMetaItem">
                      <span className="wpMetaLabel">Last Active</span>
                      <span className="wpMetaValue">
                        <span className="wpLiveDot" />
                        {stats?.lastSeenAt ? timeAgo(stats.lastSeenAt) : "—"}
                      </span>
                    </div>
                    <div className="wpMetaItem">
                      <span className="wpMetaLabel">Trades</span>
                      <span className="wpMetaValue">{stats ? stats.totalTrades.toLocaleString() : "—"}</span>
                    </div>
                    <div className="wpMetaItem">
                      <span className="wpMetaLabel">Total Volume</span>
                      <span className="wpMetaValue wpPnlValue">{fmtUsd(totalVolumeUsd)}</span>
                    </div>
                  </div>

                  <div className="wpHeaderActions">
                    <button className="wpFollowBtn">
                      <Star size={13} />
                      Follow
                    </button>
                    <button className="wpMenuBtn">
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </div>

                {/* Score card */}
                <div className="wpScoreCard">
                  <span className="wpScoreTitle">Smart Wallet Score</span>
                  <div className="wpScoreMain">
                    <div className="wpGaugeWrap">
                      <ScoreGauge score={stats?.score ?? 0} />
                      <div className="wpGaugeCenter">
                        <span className="wpGaugeScore">{stats?.score ?? 0}</span>
                        <span className="wpGaugeDenom">/ 100</span>
                      </div>
                    </div>
                    <div className="wpScoreBars">
                      {liveScoreBars.map((b) => (
                        <div key={b.label} className="wpScoreBarRow">
                          <span className="wpScoreBarLabel">{b.label}</span>
                          <div className="wpScoreBarTrack">
                            <div
                              className="wpScoreBarFill"
                              style={{ width: `${b.value}%` }}
                            />
                          </div>
                          <span className="wpScoreBarVal">{b.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <span className="wpScoreLabel">{(stats?.score ?? 0) >= 80 ? "Elite Smart Wallet" : (stats?.score ?? 0) >= 50 ? "Active Trader" : "Tracked Wallet"}</span>
                </div>

                {/* Tier card */}
                <div className="wpTierCard">
                  <div className="wpTierCrown">
                    <Gem size={20} />
                  </div>
                  <div className="wpTierName">
                    {(stats?.score ?? 0) >= 80 ? "Elite" : (stats?.score ?? 0) >= 50 ? "Pro" : (stats?.score ?? 0) > 0 ? "Tracked" : "—"}
                  </div>
                  <div className="wpTierSub">
                    <span className="wpTierRank">Score {stats?.score ?? "—"}</span>
                    <span className="wpTierPct">/ 100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Stats bar ── */}
            <div className="wpStatsBar">
              <div className="wpStat">
                <span className="wpStatLabel">Realized P&L</span>
                <span className={`wpStatValue ${stats && stats.realizedPnlUsd !== 0 ? (stats.realizedPnlUsd > 0 ? "wpPositive" : "wpNegative") : ""}`}>
                  {stats && stats.totalClosedTrades > 0
                    ? `${stats.realizedPnlUsd >= 0 ? "+" : ""}${fmtUsd(stats.realizedPnlUsd)}`
                    : "—"}
                </span>
                <span className="wpStatSub wpMuted">candle-based</span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Win Rate</span>
                <span className={`wpStatValue ${stats && stats.totalClosedTrades > 0 ? (stats.winRatePct >= 50 ? "wpPositive" : "wpNegative") : ""}`}>
                  {stats && stats.totalClosedTrades > 0 ? `${stats.winRatePct}%` : "—"}
                </span>
                <span className="wpStatSub wpMuted">
                  {stats && stats.totalClosedTrades > 0 ? `${stats.profitableTrades}/${stats.totalClosedTrades} tokens` : "no closed trades"}
                </span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Early Entry</span>
                <span className="wpStatValue wpPositive">
                  {stats && stats.totalTrades > 0 ? `${stats.earlyEntryPct}%` : "—"}
                </span>
                <span className="wpStatSub wpMuted">of trades within 500 blocks</span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Holdings Value</span>
                <span className="wpStatValue">{fmtUsd(totalHoldingsUsd)}</span>
                <span className="wpStatSub wpMuted">current prices</span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Total Trades</span>
                <span className="wpStatValue">{stats ? stats.totalTrades.toLocaleString() : "—"}</span>
                <span className="wpStatSub wpMuted">indexed</span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Tokens Traded</span>
                <span className="wpStatValue">{stats?.tokenCount ?? "—"}</span>
                <span className="wpStatSub wpMuted">unique pairs</span>
              </div>
              <div className="wpStat">
                <span className="wpStatLabel">Wallet Score</span>
                <span className="wpStatValue">{stats?.score ?? "—"}</span>
                <span className="wpStatSub wpMuted">/ 100</span>
              </div>
            </div>

            {/* ── Equity chart ── */}
            <div className="wpChartSection">
              <div className="wpChartHeader">
                <div className="wpChartTitleBlock">
                  <span className="wpChartTitle">Cumulative Trade Volume</span>
                  <span className="wpChartPnl">{fmtUsd(totalVolumeUsd)}</span>
                </div>
                <div className="wpTimeframeRow">
                  {["7D", "30D", "90D", "180D", "1Y", "All"].map((tf) => (
                    <button
                      key={tf}
                      className={`wpTfBtn${activeTimeframe === tf ? " active" : ""}`}
                      onClick={() => setActiveTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wpChartBody">
                <WalletEquityChart data={equityData} />
              </div>
            </div>

            {/* ── Bottom two-panel ── */}
            <div className="wpBottomRow">
              {/* Holdings table */}
              <div className="wpHoldingsCard">
                <div className="wpCardHeader">
                  <span className="wpCardTitle">Current Holdings ({holdings.length})</span>
                </div>
                <table className="wpTable">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Position</th>
                      <th>Current Price</th>
                      <th>24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>Loading…</td></tr>
                    ) : holdings.length === 0 ? (
                      <tr><td colSpan={4} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>No holdings found</td></tr>
                    ) : holdings.map((h) => (
                      <tr key={`${h.chain}:${h.tokenAddress}`}>
                        <td>
                          <div className="wpTokenCell">
                            <span className="wpTokenName">{h.tokenSymbol}</span>
                            <span className="wpTokenSub">{h.chain}</span>
                          </div>
                        </td>
                        <td>
                          <div className="wpTokenCell">
                            <span style={{ color: "oklch(0.94 0.008 245)", fontWeight: 600 }}>
                              {fmtUsd(h.valueUsd)}
                            </span>
                            <span className="wpTokenSub">{fmtTokenAmount(h.netAmount)}</span>
                          </div>
                        </td>
                        <td>{fmtPrice(h.priceUsd)}</td>
                        <td className={h.priceChange24h >= 0 ? "wpPositive" : "wpNegative"} style={{ fontWeight: 700 }}>
                          {h.priceChange24h !== 0 ? `${h.priceChange24h >= 0 ? "+" : ""}${h.priceChange24h.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="wpTableFooter">
                  <span className="wpFooterLabel">Total Value</span>
                  <span className="wpFooterValue">{fmtUsd(totalHoldingsUsd)}</span>
                </div>
              </div>

              {/* Activity + P&L cards */}
              <div className="wpRightCards">
                {/* Activity Summary */}
                <div className="wpInfoCard">
                  <div className="wpCardHeader">
                    <span className="wpCardTitle">Activity Summary</span>
                  </div>
                  <div className="wpInfoCardBody">
                    {(() => {
                      const buys = trades.filter(t => t.side === "buy").length;
                      const sells = trades.filter(t => t.side === "sell").length;
                      const total = buys + sells;
                      return (<>
                        <div className="wpInfoRow">
                          <span className="wpInfoLabel">Total Txns (indexed)</span>
                          <span className="wpInfoValue">{stats?.totalTrades?.toLocaleString() ?? "—"}</span>
                        </div>
                        <div className="wpInfoRow">
                          <span className="wpInfoLabel">Buys</span>
                          <span className="wpInfoValue wpPositive">{buys}{total > 0 ? ` (${Math.round(buys / total * 100)}%)` : ""}</span>
                        </div>
                        <div className="wpInfoRow">
                          <span className="wpInfoLabel">Sells</span>
                          <span className="wpInfoValue wpNegative">{sells}{total > 0 ? ` (${Math.round(sells / total * 100)}%)` : ""}</span>
                        </div>
                        <div className="wpInfoRow">
                          <span className="wpInfoLabel">Tokens Traded</span>
                          <span className="wpInfoValue">{stats?.tokenCount ?? "—"}</span>
                        </div>
                        <div className="wpInfoRow wpInfoFullRow">
                          <span className="wpInfoLabel">First Activity</span>
                          <span className="wpInfoValue">
                            {stats?.firstSeenAt ? new Date(stats.firstSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </span>
                        </div>
                        <div className="wpInfoRow wpInfoFullRow">
                          <span className="wpInfoLabel">Chains Active</span>
                          <span className="wpInfoValue">{stats?.chainCount ?? "—"}</span>
                        </div>
                      </>);
                    })()}
                  </div>
                </div>

                {/* P&L Breakdown */}
                <div className="wpInfoCard">
                  <div className="wpCardHeader">
                    <span className="wpCardTitle">P&L Breakdown</span>
                  </div>
                  <div className="wpInfoCardBody">
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Realized P&L</span>
                      <span className={`wpInfoValue ${stats && stats.totalClosedTrades > 0 ? (stats.realizedPnlUsd >= 0 ? "wpPositive" : "wpNegative") : ""}`}>
                        {stats && stats.totalClosedTrades > 0
                          ? `${stats.realizedPnlUsd >= 0 ? "+" : ""}${fmtUsd(stats.realizedPnlUsd)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Win Rate</span>
                      <span className={`wpInfoValue ${stats && stats.totalClosedTrades > 0 ? (stats.winRatePct >= 50 ? "wpPositive" : "wpNegative") : ""}`}>
                        {stats && stats.totalClosedTrades > 0 ? `${stats.winRatePct}%` : "—"}
                      </span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Profitable Tokens</span>
                      <span className="wpInfoValue">
                        {stats && stats.totalClosedTrades > 0 ? `${stats.profitableTrades} / ${stats.totalClosedTrades}` : "—"}
                      </span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Early Entry %</span>
                      <span className="wpInfoValue wpPositive">
                        {stats && stats.totalTrades > 0 ? `${stats.earlyEntryPct}%` : "—"}
                      </span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Total Volume</span>
                      <span className="wpInfoValue">{fmtUsd(totalVolumeUsd)}</span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Wallet Score</span>
                      <span className="wpInfoValue">{stats?.score ?? "—"} / 100</span>
                    </div>
                    <div className="wpInfoRow">
                      <span className="wpInfoLabel">Avg Trade Size</span>
                      <span className="wpInfoValue">{trades.length > 0 ? fmtUsd(trades.reduce((s, t) => s + t.valueUsd, 0) / trades.length) : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Recent Trades ── */}
            <div className="wpTradesCard">
              <div className="wpCardHeader">
                <span className="wpCardTitle">Recent Trades</span>
              </div>
              <div className="wpTradesScroll">
                <table className="wpTable">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Token</th>
                      <th>Chain</th>
                      <th>Value (USD)</th>
                      <th>Price</th>
                      <th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>Loading…</td></tr>
                    ) : trades.length === 0 ? (
                      <tr><td colSpan={7} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>No trades found for this wallet</td></tr>
                    ) : trades.map((t, i) => (
                      <tr
                        key={`${t.txHash}-${i}`}
                        className={t.side === "buy" ? "wpBuyRow" : "wpSellRow"}
                      >
                        <td style={{ color: "oklch(0.52 0.032 248)" }}>{timeAgo(t.occurredAt)}</td>
                        <td>
                          <span className={`wpTxType ${t.side}`}>
                            {t.side}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "oklch(0.94 0.008 245)" }}>
                          {t.tokenSymbol}
                        </td>
                        <td>
                          <span className="wpBadge cyan" style={{ height: "18px", fontSize: "9px", padding: "0 6px" }}>
                            {t.chain}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmtUsd(t.valueUsd)}</td>
                        <td>{fmtPrice(t.priceUsd)}</td>
                        <td>
                          <a
                            className="wpCopyBtn"
                            href={explorerTx(t.chain, t.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t.txHash}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {trades.length >= 50 && (
                <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--faint)", textAlign: "center" }}>
                  Showing latest 50 trades — increase limit via API for full history
                </div>
              )}
            </div>
          </main>

          {/* ── Right panel ── */}
          <aside className="wpRightPanel">
            {/* Behavior Profile */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle">Behavior Profile</div>
              <div className="wpTagCloud">
                {stats ? (() => {
                  const tags: { label: string; tone: string }[] = [];
                  if (stats.earlyEntryPct >= 40) tags.push({ label: "Early Buyer", tone: "cyan" });
                  if (stats.winRatePct >= 60 && stats.totalClosedTrades > 0) tags.push({ label: "Profit Taker", tone: "green" });
                  if (stats.winRatePct < 40 && stats.totalClosedTrades > 0) tags.push({ label: "Risk Taker", tone: "red" });
                  if (stats.chainCount >= 2) tags.push({ label: "Multi-Chain", tone: "blue" });
                  if (stats.realizedPnlUsd > 10_000 && stats.totalClosedTrades > 0) tags.push({ label: "High Earner", tone: "green" });
                  if (stats.totalTrades > 100) tags.push({ label: "Active Trader", tone: "amber" });
                  if (tags.length === 0) tags.push({ label: "Tracked Wallet", tone: "blue" });
                  return tags.map(t => (
                    <span key={t.label} className={`wpTag ${t.tone}`}>{t.label}</span>
                  ));
                })() : (
                  <span className="wpTag blue">Loading…</span>
                )}
              </div>
            </div>

            {/* Funding Analysis */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle">Funding Analysis</div>
              <div className="wpFundingCard">
                {funding === null ? (
                  <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0", textAlign: "center" }}>Loading…</div>
                ) : funding.likelyFunders.length === 0 && funding.likelyFundedWallets.length === 0 ? (
                  <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0", textAlign: "center" }}>No funding edges indexed yet</div>
                ) : (
                  <>
                    {funding.likelyFunders.slice(0, 3).map((f, i) => (
                      <div key={i} style={{ paddingBottom: i < Math.min(funding.likelyFunders.length, 3) - 1 ? 10 : 0, marginBottom: i < Math.min(funding.likelyFunders.length, 3) - 1 ? 10 : 0, borderBottom: i < Math.min(funding.likelyFunders.length, 3) - 1 ? "1px solid var(--line-soft)" : "none" }}>
                        <div className="wpFundingRow">
                          <span className="wpFundingLabel">Funded by</span>
                          <span className="wpFundingAddr">{f.fromAddress.slice(0, 6)}…{f.fromAddress.slice(-4)}</span>
                        </div>
                        <div className="wpFundingRow">
                          <span className="wpFundingLabel">Chain</span>
                          <span className="wpFundingVal">{f.chain.toUpperCase()}</span>
                        </div>
                        <div className="wpFundingRow">
                          <span className="wpFundingLabel">Transfers</span>
                          <span className="wpFundingVal">{f.transferCount}</span>
                        </div>
                        <div className="wpFundingRow">
                          <span className="wpFundingLabel">Confidence</span>
                          <span className="wpFundingVal">{(Number(f.confidence) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                    {funding.likelyFundedWallets.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
                        <div className="wpFundingLabel" style={{ marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Also funds ({funding.likelyFundedWallets.length})
                        </div>
                        {funding.likelyFundedWallets.slice(0, 3).map((f, i) => (
                          <div key={i} className="wpFundingRow">
                            <span className="wpFundingAddr">{f.toAddress.slice(0, 6)}…{f.toAddress.slice(-4)}</span>
                            <span className="wpFundingVal" style={{ color: "var(--faint)" }}>{f.chain.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Connected Wallets */}
            <div className="wpRightSection">
              {(() => {
                const connectedNodes = graph
                  ? graph.nodes.filter(n => n.id !== address.toLowerCase()).slice(0, 6)
                  : [];
                const totalConnected = graph ? graph.nodes.length - 1 : 0;
                return (
                  <>
                    <div className="wpRightSectionTitle">
                      Connected Wallets ({graph ? totalConnected : "…"})
                    </div>
                    <div className="wpGraphCard">
                      <div className="wpGraphViz" suppressHydrationWarning>
                        {connectedNodes.map((node, i) => (
                          <div
                            key={i}
                            className="wpGraphLine"
                            suppressHydrationWarning
                            style={{
                              width: "62px",
                              transform: `translateY(-50%) rotate(${GRAPH_ANGLES[i] ?? 0}deg)`,
                              left: "50%",
                              top: "50%",
                            }}
                          />
                        ))}
                        <div className="wpGraphCenter">🦊</div>
                        {connectedNodes.map((node, i) => {
                          const rad = ((GRAPH_ANGLES[i] ?? 0) * Math.PI) / 180;
                          const r = 62;
                          const nx = parseFloat((50 + (r / 160) * 100 * Math.cos(rad)).toFixed(2));
                          const ny = parseFloat((50 + (r / 160) * 100 * Math.sin(rad)).toFixed(2));
                          return (
                            <div
                              key={i}
                              className="wpGraphNode"
                              style={{ left: `${nx}%`, top: `${ny}%` }}
                            >
                              <div className="wpGraphNodeDot">{graphNodeEmoji(node.type)}</div>
                              <span className="wpGraphNodeLabel">{node.label}</span>
                            </div>
                          );
                        })}
                        {graph === null && (
                          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 11 }}>
                            Loading…
                          </div>
                        )}
                        {graph !== null && connectedNodes.length === 0 && (
                          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 11 }}>
                            No connections found
                          </div>
                        )}
                      </div>
                      <button type="button" className="wpGraphLink" onClick={() => router.push(`/wallet/${address}`)}>
                        View Full Graph
                        <ExternalLink size={11} style={{ marginLeft: 4 }} />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* If You Copied This Wallet */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                If You Copied This Wallet
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 999, background: "oklch(0.55 0.15 80 / 0.15)", color: "oklch(0.82 0.18 80)", border: "1px solid oklch(0.55 0.15 80 / 0.35)" }}>Demo</span>
              </div>
              <div className="wpCopySection">
                {copySimRows.map((row) => (
                  <div key={row.period} className="wpCopyRow">
                    <span className="wpCopyPeriod">{row.period}</span>
                    <div className="wpCopyRight">
                      <MiniSparkline data={row.spark} />
                      <span className="wpCopyReturn">{row.ret}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Similar Wallets */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Similar Wallets
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 999, background: "oklch(0.55 0.15 80 / 0.15)", color: "oklch(0.82 0.18 80)", border: "1px solid oklch(0.55 0.15 80 / 0.35)" }}>Demo</span>
              </div>
              <div className="wpSimilarList">
                {similarWallets.map((w) => (
                  <div key={w.addr} className="wpSimilarRow">
                    <div
                      className="wpSimilarAvatar"
                      style={{ background: w.color }}
                    >
                      {w.emoji}
                    </div>
                    <div className="wpSimilarMeta">
                      <span className="wpSimilarAddr">{w.addr}</span>
                      <span className="wpSimilarPct">{w.sim} similar</span>
                    </div>
                    <span className="wpSimilarReturn">{w.ret}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
