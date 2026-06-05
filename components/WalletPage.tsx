"use client";

import { useState, useEffect } from "react";
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
  ChevronDown,
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

// ── Static display helpers ─────────────────────────────────────────────────────

const scoreBars = [
  { label: "Activity", value: 0 },
  { label: "Diversity", value: 0 },
  { label: "Multi-chain", value: 0 },
  { label: "Volume", value: 0 },
  { label: "Consistency", value: 0 },
];

const connectedWallets = [
  { addr: "0x5e21...9d4a", emoji: "🦊", angle: 0 },
  { addr: "0x9a3b...7c1d", emoji: "🐋", angle: 60 },
  { addr: "0x1f32...aa11", emoji: "🎯", angle: 120 },
  { addr: "0x8e77...2b1f", emoji: "⚡", angle: 180 },
  { addr: "0x4ab3...9f2d", emoji: "💎", angle: 240 },
  { addr: "0x12d1...c3a2", emoji: "🔮", angle: 300 },
];

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
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [address]);

  // Derive equity curve from cumulative trade volumes over time
  const equityData = (() => {
    if (trades.length === 0) return [{ month: "—", value: 0 }];
    const byMonth = new Map<string, number>();
    for (const t of [...trades].reverse()) {
      const d = new Date(t.occurredAt);
      const key = `${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + t.valueUsd);
    }
    let running = 0;
    return Array.from(byMonth.entries()).map(([month, v]) => {
      running += v;
      return { month, value: Math.round(running) };
    });
  })();

  const totalVolumeUsd = stats?.totalVolumeUsd ?? trades.reduce((s, t) => s + t.valueUsd, 0);
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
            <button key={item.label} className="wpNavItem">
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
            <button key={item.label} className="wpNavItem">
              {item.icon}
              <span className="wpNavItemLabel">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="wpNavDivider" />

        <div className="wpNavSection">Settings</div>
        <div className="wpNavGroup">
          {SETTINGS_ITEMS.map((item) => (
            <button key={item.label} className="wpNavItem">
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
              <span className="wpAlertBadge">12</span>
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
                          href={`https://basescan.org/address/${shortAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wpCopyBtn"
                          title="View on explorer"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      <div className="wpBadgeRow">
                        <span className="wpBadge cyan">Smart Wallet</span>
                        <span className="wpBadge amber">Elite Tier</span>
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
                  <div className="wpTierName">Elite</div>
                  <div className="wpTierSub">
                    <span className="wpTierRank">Rank #1,248</span>
                    <span className="wpTierPct">Top 2.3%</span>
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
                  <button className="wpViewAllBtn">
                    View All
                    <ChevronDown size={12} />
                  </button>
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
                      <th>MCap at Time</th>
                      <th>P&L (USD)</th>
                      <th>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>Loading…</td></tr>
                    ) : trades.length === 0 ? (
                      <tr><td colSpan={9} style={{ color: "oklch(0.52 0.032 248)", textAlign: "center" }}>No trades found for this wallet</td></tr>
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
                        <td className="wpMuted">—</td>
                        <td className="wpMuted">—</td>
                        <td className="wpMuted">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="wpViewAllLink">View All Transactions →</button>
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
                <div className="wpFundingRow">
                  <span className="wpFundingLabel">Funded by</span>
                  <span className="wpFundingAddr">0x4ab3...9f2d</span>
                </div>
                <div className="wpFundingRow">
                  <span className="wpFundingLabel">4 months ago</span>
                  <span className="wpFundingVal" style={{ color: "oklch(0.52 0.032 248)" }}>
                    May 2025
                  </span>
                </div>
                <div className="wpFundingRow">
                  <span className="wpFundingLabel">Value at time</span>
                  <span className="wpFundingVal">$12,500</span>
                </div>
                <div className="wpFundingRow">
                  <span className="wpFundingLabel">Total received</span>
                  <span className="wpFundingVal">$12,500</span>
                </div>
              </div>
            </div>

            {/* Connected Wallets */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle">Connected Wallets (7)</div>
              <div className="wpGraphCard">
                <div className="wpGraphViz" suppressHydrationWarning>
                  {/* Lines — use node.angle directly; avoids atan2 float divergence between SSR/client */}
                  {connectedWallets.map((node, i) => (
                    <div
                      key={i}
                      className="wpGraphLine"
                      suppressHydrationWarning
                      style={{
                        width: "62px",
                        transform: `translateY(-50%) rotate(${node.angle}deg)`,
                        left: "50%",
                        top: "50%",
                      }}
                    />
                  ))}

                  {/* Center node */}
                  <div className="wpGraphCenter">🦊</div>

                  {/* Surrounding nodes — pre-compute positions with rounded values */}
                  {connectedWallets.map((node, i) => {
                    const rad = (node.angle * Math.PI) / 180;
                    const r = 62;
                    // Round to 2dp so SSR and client always agree
                    const nx = parseFloat((50 + (r / 160) * 100 * Math.cos(rad)).toFixed(2));
                    const ny = parseFloat((50 + (r / 160) * 100 * Math.sin(rad)).toFixed(2));
                    return (
                      <div
                        key={i}
                        className="wpGraphNode"
                        style={{ left: `${nx}%`, top: `${ny}%` }}
                      >
                        <div className="wpGraphNodeDot">{node.emoji}</div>
                        <span className="wpGraphNodeLabel">{node.addr}</span>
                      </div>
                    );
                  })}
                </div>
                <a href="#" className="wpGraphLink">
                  View Full Graph
                  <ExternalLink size={11} style={{ marginLeft: 4 }} />
                </a>
              </div>
            </div>

            {/* If You Copied This Wallet */}
            <div className="wpRightSection">
              <div className="wpRightSectionTitle">If You Copied This Wallet</div>
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
              <div className="wpRightSectionTitle">Similar Wallets</div>
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
