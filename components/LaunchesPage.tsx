"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  ExternalLink,
  Filter,
  Gem,
  Grid,
  Info,
  KeyRound,
  Layers,
  List,
  Lock,
  Radar,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "../app/launches/launches.css";
import { MobileBottomNav } from "./MobileBottomNav";

// ── Shared types from market API ──────────────────────────────
interface TokenSummary {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  ageMinutes: number;
  priceUsd: number;
  priceChange24h: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  buys: number;
  sells: number;
  riskScore: number;
  riskLevel: string;
  trendingScore: number;
  lastActivityAt: string;
  launchPlatform: string | null;
}

// ── Formatting helpers ────────────────────────────────────────
function fmtUsd(v: number): string {
  if (v <= 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function summaryToLaunch(token: TokenSummary, idx: number): TokenLaunch {
  const palettes = ["cyan", "violet", "amber", "green", "rose", "blue"];
  const risk: RiskLevel =
    token.riskLevel === "Low" ? "Low"
    : token.riskLevel === "Medium" ? "Medium"
    : token.riskLevel === "High" ? "High"
    : "Very High";
  const smartScore = Math.round(Math.max(0, Math.min(100, 100 - token.riskScore + token.trendingScore * 0.3)));
  return {
    id: token.address,
    symbol: token.symbol,
    name: token.name || token.symbol,
    pair: `${token.symbol}/WETH`,
    chain: token.chain as Chain,
    launchedAt: new Date(token.lastActivityAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    age: fmtAge(token.ageMinutes),
    marketCap: fmtUsd(token.marketCapUsd),
    volume24h: fmtUsd(token.volume24hUsd),
    liquidity: fmtUsd(token.liquidityUsd),
    liquidityLocked: false,
    smartScore,
    risk,
    address: token.address,
    starred: false,
    logoPalette: palettes[idx % palettes.length],
    launchPlatform: token.launchPlatform ?? null,
  };
}

/* ══════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════ */

type Chain = "base" | "eth" | "bsc" | "arb" | "sol";
type RiskLevel = "Low" | "Medium" | "High" | "Very High";
type Tab = "all" | "new-pairs" | "fair-launch" | "presale" | "graduated" | "dex-launch";
type Timeframe = "5M" | "15M" | "1H" | "6H" | "24H" | "7D";
type ViewMode = "grid" | "list";
type RiskFilter = "All" | "Low" | "Medium" | "High" | "Scam";

interface TokenLaunch {
  id: string;
  symbol: string;
  name: string;
  pair: string;
  chain: Chain;
  launchedAt: string;
  age: string;
  marketCap: string;
  volume24h: string;
  liquidity: string;
  liquidityLocked: boolean;
  smartScore: number;
  risk: RiskLevel;
  address: string;
  starred: boolean;
  logoPalette: string;
  launchPlatform: string | null;
}


/* ══════════════════════════════════════════════════════════
   Sidebar nav config
══════════════════════════════════════════════════════════ */

const NAV_SECTIONS = [
  {
    title: "",
    items: [
      { label: "Radar",        icon: Radar,           route: "/" },
      { label: "Launches",     icon: Activity,        route: "/launches",     active: true },
      { label: "Watchlist",    icon: Star },
      { label: "Opportunities",icon: Gem },
      { label: "Alerts",       icon: Bell },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money",    icon: Zap,       route: "/smart-money" },
      { label: "Wallet Explorer",icon: Wallet },
      { label: "Holder Analysis",icon: Crosshair },
      { label: "Risk Scanner",   icon: Shield },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools",         icon: Layers },
      { label: "Liquidity Locks",   icon: Lock },
      { label: "Contract Analyzer", icon: Database },
      { label: "Top Gainers",       icon: TrendingUp },
      { label: "Top Volume",        icon: CircleDollarSign },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings",      icon: Settings },
      { label: "API Access",    icon: KeyRound },
      { label: "Documentation", icon: BookOpen },
    ],
  },
];

/* ══════════════════════════════════════════════════════════
   Helper: score colour
══════════════════════════════════════════════════════════ */

function scoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 50) return "var(--amber)";
  if (score >= 20) return "var(--red)";
  return "oklch(0.52 0.2 25)";
}

/* ══════════════════════════════════════════════════════════
   Donut gauge SVG
══════════════════════════════════════════════════════════ */

function SmartScoreGauge({ score }: { score: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <svg
      className="lpScoreDonut"
      width="36"
      height="36"
      viewBox="0 0 36 36"
      role="img"
      aria-label={`Smart Score ${score}`}
    >
      {/* Track */}
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="oklch(0.34 0.028 255 / 0.4)"
        strokeWidth="4"
      />
      {/* Fill */}
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        strokeDashoffset={circ * 0.25}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      {/* Center text */}
      <text
        x="18"
        y="22"
        textAnchor="middle"
        fill={color}
        fontSize="9"
        fontWeight="800"
      >
        {score}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   Mini sparkline SVG
══════════════════════════════════════════════════════════ */

function MiniSparkline({ tone }: { tone: "green" | "amber" | "red" }) {
  const pts: Record<typeof tone, string> = {
    green: "2,18 10,15 18,11 28,13 38,8 48,10 54,5",
    amber: "2,12 10,16 18,14 28,10 38,14 48,11 54,16",
    red:   "2,8  10,10 18,14 28,12 38,16 48,18 54,20",
  };
  return (
    <svg className={`lpMiniSparkline ${tone}`} viewBox="0 0 56 24" aria-hidden="true">
      <polyline points={pts[tone]} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   Top Navbar
══════════════════════════════════════════════════════════ */

function TopNavbar() {
  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb">
          <Radar size={22} />
        </span>
        <div>
          <strong>Chain Screener</strong>
          <span>Launch radar</span>
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
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════
   Sidebar
══════════════════════════════════════════════════════════ */

function Sidebar() {
  const router = useRouter();

  return (
    <aside className="sidebar">
      <nav aria-label="Navigation">
        {NAV_SECTIONS.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? (
              <span className="navSectionTitle">{section.title}</span>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = "active" in item && item.active;
              return (
                <button
                  className={`sideNavItem ${isActive ? "active" : ""}`}
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if ("route" in item && item.route) router.push(item.route);
                  }}
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

/* ══════════════════════════════════════════════════════════
   Stat cards
══════════════════════════════════════════════════════════ */

interface LaunchStats {
  total: number;
  safe: number;
  highRisk: number;
  veryHigh: number;
  totalVolume: number;
  avgAgeMinutes: number;
}

function StatCards({ stats }: { stats: LaunchStats }) {
  const { total, safe, highRisk, veryHigh, totalVolume, avgAgeMinutes } = stats;
  const safeP = total > 0 ? ((safe / total) * 100).toFixed(1) : "0";
  const riskP = total > 0 ? ((highRisk / total) * 100).toFixed(1) : "0";
  const vhP   = total > 0 ? ((veryHigh / total) * 100).toFixed(1) : "0";
  const avgH = Math.floor(avgAgeMinutes / 60);
  const avgM = Math.round(avgAgeMinutes % 60);
  const avgFmt = avgAgeMinutes > 0 ? `${avgH > 0 ? `${avgH}h ` : ""}${avgM}m` : "—";

  return (
    <div className="lpStatGrid">
      <div className="lpStatCard">
        <span className="lpStatLabel">Tracked Tokens</span>
        <span className="lpStatValue">{total > 0 ? total.toLocaleString() : "—"}</span>
        <div className="lpStatMeta"><MiniSparkline tone="green" /></div>
      </div>
      <div className="lpStatCard">
        <span className="lpStatLabel">Low Risk</span>
        <span className="lpStatValue" style={{ color: "var(--green)" }}>{safe > 0 ? safe : "—"}</span>
        <div className="lpStatMeta">
          <span className="lpStatChange positive">{total > 0 ? `${safeP}%` : ""}</span>
        </div>
      </div>
      <div className="lpStatCard">
        <span className="lpStatLabel">High Risk</span>
        <span className="lpStatValue" style={{ color: "var(--amber)" }}>{highRisk > 0 ? highRisk : "—"}</span>
        <div className="lpStatMeta">
          <span className="lpStatChange amber">{total > 0 ? `${riskP}%` : ""}</span>
        </div>
      </div>
      <div className="lpStatCard">
        <span className="lpStatLabel">Very High Risk</span>
        <span className="lpStatValue" style={{ color: "var(--red)" }}>{veryHigh > 0 ? veryHigh : "—"}</span>
        <div className="lpStatMeta">
          <span className="lpStatChange negative">{total > 0 ? `${vhP}%` : ""}</span>
        </div>
      </div>
      <div className="lpStatCard">
        <span className="lpStatLabel">Total Volume (24H)</span>
        <span className="lpStatValue">{totalVolume > 0 ? fmtUsd(totalVolume) : "—"}</span>
        <div className="lpStatMeta"><MiniSparkline tone="green" /></div>
      </div>
      <div className="lpStatCard">
        <span className="lpStatLabel">Avg. Age</span>
        <span className="lpStatValue">{avgFmt}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Filter tab bar
══════════════════════════════════════════════════════════ */

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all",        label: "All Launches" },
  { id: "new-pairs",  label: "New Pairs" },
  { id: "fair-launch",label: "Fair Launch" },
  { id: "presale",    label: "Presale" },
  { id: "graduated",  label: "Graduated" },
  { id: "dex-launch", label: "DEX Launch" },
];

function TabBar({
  active,
  onTabChange,
  view,
  onViewChange,
}: {
  active: Tab;
  onTabChange: (t: Tab) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div className="lpTabBar">
      <div className="lpTabGroup">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`lpTab ${active === tab.id ? "lpTabActive" : ""}`}
            type="button"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="lpTabRight">
        <button className="lpSortSelect" type="button">
          Newest <ChevronDown size={13} />
        </button>
        <div className="lpViewToggle">
          <button
            className={view === "grid" ? "lpViewActive" : ""}
            type="button"
            aria-label="Grid view"
            onClick={() => onViewChange("grid")}
          >
            <Grid size={14} />
          </button>
          <button
            className={view === "list" ? "lpViewActive" : ""}
            type="button"
            aria-label="List view"
            onClick={() => onViewChange("list")}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Token table
══════════════════════════════════════════════════════════ */

function TokenTable({
  tokens,
  onRowClick,
}: {
  tokens: TokenLaunch[];
  onRowClick: (token: TokenLaunch) => void;
}) {
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarred((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="lpTableWrap">
      <table className="lpTable">
        <thead>
          <tr>
            <th>☆</th>
            <th>Token / Pair</th>
            <th>Chain</th>
            <th>Platform</th>
            <th>Launched</th>
            <th>Age</th>
            <th>Market Cap</th>
            <th>Volume (24H)</th>
            <th>Liquidity</th>
            <th>Smart Score</th>
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id} onClick={() => onRowClick(token)}>
              {/* Star */}
              <td>
                <button
                  className={`lpStarBtn ${starred[token.id] ? "lpStarred" : ""}`}
                  type="button"
                  aria-label={`${starred[token.id] ? "Unstar" : "Star"} ${token.symbol}`}
                  onClick={(e) => toggleStar(e, token.id)}
                >
                  <Star size={13} fill={starred[token.id] ? "currentColor" : "none"} />
                </button>
              </td>

              {/* Token/Pair */}
              <td>
                <div className="lpTokenCell">
                  <span className={`lpTokenLogo ${token.logoPalette}`}>
                    {token.symbol.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <span className="lpTokenName">{token.symbol}</span>
                    <span className="lpTokenPair">{token.pair}</span>
                  </span>
                </div>
              </td>

              {/* Chain */}
              <td>
                <span className={`lpChainBadge ${token.chain}`}>
                  {token.chain === "eth" ? "ETH" : token.chain.toUpperCase()}
                </span>
              </td>

              {/* Platform */}
              <td>
                <PlatformBadge platform={token.launchPlatform} />
              </td>

              {/* Launched */}
              <td style={{ color: "var(--muted)", fontSize: 11 }}>{token.launchedAt}</td>

              {/* Age */}
              <td style={{ color: "var(--faint)", fontSize: 11 }}>{token.age}</td>

              {/* Market cap */}
              <td style={{ color: "var(--text)", fontWeight: 700 }}>{token.marketCap}</td>

              {/* Volume */}
              <td style={{ color: "var(--text)" }}>{token.volume24h}</td>

              {/* Liquidity */}
              <td>
                <div className="lpLiqCell">
                  {token.liquidity}
                  {token.liquidityLocked ? (
                    <Lock size={12} className="lpLockIcon" aria-label="Liquidity locked" />
                  ) : (
                    <AlertTriangle size={12} className="lpWarnIcon" aria-label="Liquidity unlocked" />
                  )}
                </div>
              </td>

              {/* Smart Score */}
              <td>
                <div className="lpScoreCell">
                  <SmartScoreGauge score={token.smartScore} />
                </div>
              </td>

              {/* Risk */}
              <td>
                <RiskBadge level={token.risk} />
              </td>

              {/* Actions */}
              <td>
                <div className="lpActions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`lpActionBtn ${starred[token.id] ? "lpStarred" : ""}`}
                    type="button"
                    aria-label="Favourite"
                    onClick={(e) => toggleStar(e, token.id)}
                  >
                    <Star size={12} fill={starred[token.id] ? "currentColor" : "none"} />
                  </button>
                  <a
                    className="lpActionBtn"
                    href={`https://basescan.org/address/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View on explorer"
                    style={{ display: "grid", placeItems: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} />
                  </a>
                  <button className="lpActionBtn" type="button" aria-label="View chart">
                    <BarChart2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const cls: Record<RiskLevel, string> = {
    "Low":       "low",
    "Medium":    "medium",
    "High":      "high",
    "Very High": "very-high",
  };
  return (
    <span className={`lpRiskBadge ${cls[level]}`}>{level}</span>
  );
}

/* ══════════════════════════════════════════════════════════
   Platform badge (inline in token table rows)
══════════════════════════════════════════════════════════ */

const PLATFORM_META: Record<string, { label: string; icon: string; cls: string }> = {
  clanker: { label: "Clanker", icon: "🤖", cls: "clanker" },
  bankr:   { label: "Bankr",   icon: "🏦", cls: "bankr"   },
};

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  return (
    <span className={`lpPlatformBadge ${meta.cls}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   Platform section — compact token strip per launchpad
══════════════════════════════════════════════════════════ */

interface PlatformSectionProps {
  platformKey: string;
  tokens: TokenSummary[];
  onTokenClick: (address: string, chain: string) => void;
}

function PlatformSection({ platformKey, tokens, onTokenClick }: PlatformSectionProps) {
  const meta = PLATFORM_META[platformKey];
  if (!meta || tokens.length === 0) return null;

  const top = tokens.slice(0, 8);

  return (
    <div className={`lpPlatformSection ${meta.cls}`}>
      <div className="lpPlatformSectionHead">
        <span className="lpPlatformSectionTitle">
          <span className="lpPlatformIcon">{meta.icon}</span>
          {meta.label}
          <span className="lpPlatformChainPill">Base</span>
        </span>
        <span className="lpPlatformCount">{tokens.length} tokens</span>
      </div>

      <div className="lpPlatformCards">
        {top.map((token) => {
          const pctChange = token.priceChange24h;
          const isUp = pctChange >= 0;
          return (
            <button
              key={token.address}
              className="lpPlatformCard"
              type="button"
              onClick={() => onTokenClick(token.address, token.chain)}
            >
              <div className="lpPlatformCardSymbol">
                <span className={`lpPlatformCardLogo ${platformKey}`}>
                  {token.symbol.slice(0, 2).toUpperCase()}
                </span>
                <span className="lpPlatformCardTicker">{token.symbol}</span>
              </div>
              <div className={`lpPlatformCardChange ${isUp ? "up" : "down"}`}>
                {isUp ? "▲" : "▼"} {Math.abs(pctChange).toFixed(1)}%
              </div>
              <div className="lpPlatformCardVol">
                {fmtUsd(token.volume24hUsd)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Hot Launch Alerts ticker — uses real newest tokens
══════════════════════════════════════════════════════════ */

function HotAlertsBand({ rawTokens }: { rawTokens: TokenSummary[] }) {
  if (rawTokens.length === 0) return null;

  // Newest 2 by lastActivityAt, highest volume, highest gainer
  const newest = rawTokens.slice(0, 2);
  const highVol = [...rawTokens].sort((a, b) => b.volume24hUsd - a.volume24hUsd)[0];
  const topGainer = [...rawTokens].sort((a, b) => b.priceChange24h - a.priceChange24h)[0];
  const highRisk = rawTokens.find(t => t.riskLevel === "High" || t.riskLevel === "Extreme");

  const alerts = [
    ...newest.map(t => ({
      type: "new" as const,
      title: `${t.symbol} / WETH`,
      detail: `New on ${t.chain.toUpperCase()}`,
      time: fmtAge(t.ageMinutes),
    })),
    highVol ? {
      type: "volume" as const,
      title: `${highVol.symbol} / WETH`,
      detail: `Vol: ${fmtUsd(highVol.volume24hUsd)} (24H)`,
      time: fmtAge(highVol.ageMinutes),
    } : null,
    topGainer && topGainer.priceChange24h > 0 ? {
      type: "smart" as const,
      title: topGainer.symbol,
      detail: `+${topGainer.priceChange24h.toFixed(1)}% in 24H`,
      time: fmtAge(topGainer.ageMinutes),
    } : null,
    highRisk ? {
      type: "locked" as const,
      title: `${highRisk.symbol} — Risk Alert`,
      detail: `${highRisk.riskLevel} risk detected`,
      time: fmtAge(highRisk.ageMinutes),
    } : null,
  ].filter(Boolean) as { type: "new" | "volume" | "smart" | "locked"; title: string; detail: string; time: string }[];

  if (alerts.length === 0) return null;

  return (
    <div className="lpAlertBand">
      <div className="lpAlertBandLabel">
        <Zap size={14} />
        Live Alerts
      </div>
      <div className="lpAlertCards">
        {alerts.map((alert, i) => (
          <div className="lpAlertCard" key={i}>
            <div className={`lpAlertType ${alert.type}`}>
              {alert.type === "new" && <><Zap size={10} /> New Launch</>}
              {alert.type === "volume" && <><TrendingUp size={10} /> High Volume</>}
              {alert.type === "smart" && <><Wallet size={10} /> Top Gainer</>}
              {alert.type === "locked" && <><Lock size={10} /> Risk Alert</>}
            </div>
            <span className="lpAlertTitle">{alert.title}</span>
            <div className="lpAlertDetail">
              {alert.detail}
              <span className="lpAlertTime">{alert.time}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="lpAlertViewAll" type="button">
        View all alerts <ArrowRight size={13} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Filters
══════════════════════════════════════════════════════════ */

function FiltersPanel() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("Low");
  const [hideScams, setHideScams] = useState(true);

  const riskOptions: RiskFilter[] = ["All", "Low", "Medium", "High", "Scam"];

  return (
    <div className="lpFilterPanel">
      <div className="lpPanelHead">
        <h3>Filters</h3>
        <button className="lpPanelResetLink" type="button">
          Reset
        </button>
      </div>
      <div className="lpPanelBody">
        {/* Time Range */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">
            Time Range <span className="lpInfoIcon">i</span>
          </label>
          <button className="lpFilterSelect" type="button">
            24 Hours <ChevronDown size={14} />
          </button>
        </div>

        {/* Chain */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">
            Chain <span className="lpInfoIcon">i</span>
          </label>
          <button className="lpFilterSelect" type="button">
            All Chains <ChevronDown size={14} />
          </button>
        </div>

        {/* Launch Type */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Launch Type</label>
          <button className="lpFilterSelect" type="button">
            All Types <ChevronDown size={14} />
          </button>
        </div>

        {/* Risk Level */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Risk Level</label>
          <div className="lpRiskGroup">
            {riskOptions.map((opt) => (
              <button
                key={opt}
                className={`lpRiskBtn ${riskFilter === opt ? "lpRiskActive" : ""}`}
                type="button"
                onClick={() => setRiskFilter(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Min. Liquidity */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Min. Liquidity</label>
          <div className="lpMinLiqInput">
            <span>$</span>
            <input type="number" placeholder="0" min={0} />
          </div>
        </div>

        {/* Hide known scams */}
        <div className="lpToggleRow">
          <span className="lpToggleLabel">Hide known scams</span>
          <button
            className={`lpToggle ${hideScams ? "lpToggleOn" : ""}`}
            type="button"
            role="switch"
            aria-checked={hideScams}
            onClick={() => setHideScams((v) => !v)}
          />
        </div>

        {/* Apply */}
        <button className="lpApplyBtn" type="button">
          <Filter size={14} /> Apply Filters (3)
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Launch Trends
══════════════════════════════════════════════════════════ */

const CHAIN_COLORS: Record<string, string> = {
  base: "oklch(0.55 0.28 260)",
  eth:  "oklch(0.65 0.16 275)",
  bsc:  "oklch(0.8 0.15 83)",
};

function LaunchTrendsPanel({ rawTokens }: { rawTokens: TokenSummary[] }) {
  const byChain = rawTokens.reduce<Record<string, { count: number; volume: number }>>((acc, t) => {
    const k = t.chain;
    if (!acc[k]) acc[k] = { count: 0, volume: 0 };
    acc[k].count++;
    acc[k].volume += t.volume24hUsd;
    return acc;
  }, {});

  const chainList = Object.entries(byChain)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  const maxCount = chainList[0]?.[1].count ?? 1;

  if (chainList.length === 0) {
    return (
      <div className="lpTrendsPanel">
        <div className="lpPanelHead"><h3>Launch Trends</h3></div>
        <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0" }}>No data yet</div>
      </div>
    );
  }

  return (
    <div className="lpTrendsPanel">
      <div className="lpPanelHead">
        <h3>Launch Trends</h3>
        <button className="lpDropdownBtn" type="button">
          24H <ChevronDown size={12} />
        </button>
      </div>
      <div className="lpTrendsList">
        {chainList.map(([chain, data]) => (
          <div className="lpTrendRow" key={chain}>
            <span className="lpTrendName">{chain === "eth" ? "Ethereum" : chain.toUpperCase()}</span>
            <div style={{ position: "relative", height: 6, background: "oklch(0.34 0.028 255 / 0.3)", borderRadius: 3, overflow: "hidden" }}>
              <div
                className="lpTrendBar"
                style={{
                  background: CHAIN_COLORS[chain] ?? "oklch(0.6 0.15 255)",
                  width: `${(data.count / maxCount) * 100}%`,
                  height: "100%",
                  borderRadius: 3,
                }}
              />
            </div>
            <span className="lpTrendCount">{data.count}</span>
            <span className="lpTrendPct positive">{fmtUsd(data.volume)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Launch Quality donut
══════════════════════════════════════════════════════════ */

function LaunchQualityPanel() {
  return (
    <div className="lpQualityPanel">
      <div className="lpPanelHead">
        <h3>Launch Quality</h3>
        <button className="lpDropdownBtn" type="button">
          24H <ChevronDown size={12} />
        </button>
      </div>
      <div className="lpQualityBody">
        <div className="lpQualityDonut" aria-label="Launch quality distribution" />
        <div className="lpQualityLegend">
          <div className="lpLegendItem">
            <span className="lpLegendDot" style={{ background: "var(--green)" }} />
            <span className="lpLegendLabel">Low Risk</span>
            <span className="lpLegendPct">58.3%</span>
          </div>
          <div className="lpLegendItem">
            <span className="lpLegendDot" style={{ background: "var(--amber)" }} />
            <span className="lpLegendLabel">Medium Risk</span>
            <span className="lpLegendPct">21.4%</span>
          </div>
          <div className="lpLegendItem">
            <span className="lpLegendDot" style={{ background: "var(--orange)" }} />
            <span className="lpLegendLabel">High Risk</span>
            <span className="lpLegendPct">10.3%</span>
          </div>
          <div className="lpLegendItem">
            <span className="lpLegendDot" style={{ background: "var(--red)" }} />
            <span className="lpLegendLabel">Scam Risk</span>
            <span className="lpLegendPct">10.0%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Top by Market Cap
══════════════════════════════════════════════════════════ */

function TopByMcap({ rawTokens }: { rawTokens: TokenSummary[] }) {
  const top = [...rawTokens]
    .filter(t => t.marketCapUsd > 0)
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd)
    .slice(0, 5);

  return (
    <div className="lpGradPanel">
      <div className="lpGradPanelHead">
        <h3>Top by Market Cap</h3>
      </div>
      <div className="lpGradList">
        {top.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0" }}>No market cap data yet</div>
        ) : top.map((token) => (
          <div className="lpGradRow" key={token.address}>
            <div className="lpGradInfo">
              <span className="lpGradName">{token.symbol}</span>
              <span className="lpGradMeta">{token.chain.toUpperCase()} · {fmtAge(token.ageMinutes)}</span>
            </div>
            <span className="lpGradMcap">{fmtUsd(token.marketCapUsd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main LaunchesPage export
══════════════════════════════════════════════════════════ */

export function LaunchesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("24H");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [rawTokens, setRawTokens] = useState<TokenSummary[]>([]);
  const [platformTokens, setPlatformTokens] = useState<Record<string, TokenSummary[]>>({});
  const [loading, setLoading] = useState(true);

  const timeframes: Timeframe[] = ["5M", "15M", "1H", "6H", "24H", "7D"];

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    setLoading(true);

    // Fetch all launches + per-platform strips in parallel
    Promise.all([
      fetch(`${api}/api/launches`).then(r => r.json()),
      fetch(`${api}/api/launches/by-platform`).then(r => r.json()),
    ])
      .then(([launchData, platformData]) => {
        setRawTokens(launchData.data ?? []);
        setPlatformTokens(platformData ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Map raw TokenSummary → TokenLaunch for the table
  const launches: TokenLaunch[] = rawTokens.map(summaryToLaunch);

  // Compute stats from real data
  const stats: LaunchStats = {
    total: rawTokens.length,
    safe: rawTokens.filter(t => t.riskLevel === "Low").length,
    highRisk: rawTokens.filter(t => t.riskLevel === "High").length,
    veryHigh: rawTokens.filter(t => t.riskLevel === "Extreme" || t.riskScore > 75).length,
    totalVolume: rawTokens.reduce((s, t) => s + t.volume24hUsd, 0),
    avgAgeMinutes: rawTokens.length > 0 ? Math.round(rawTokens.reduce((s, t) => s + t.ageMinutes, 0) / rawTokens.length) : 0,
  };

  const handleRowClick = (token: TokenLaunch) => {
    router.push(`/token/${token.chain}/${token.address}`);
  };

  const handlePlatformTokenClick = (address: string, chain: string) => {
    router.push(`/token/${chain}/${address}`);
  };

  return (
    <div className="appShell">
      <TopNavbar />
      <div className="lpShell">
        {/* ── Sidebar ── */}
        <Sidebar />

        {/* ── Main content ── */}
        <main className="lpMain">
          {/* Page header */}
          <div className="lpHeader">
            <div className="lpHeaderLeft">
              <h1>Launches</h1>
              <p>Track new token launches across all chains in real-time.</p>
            </div>
            <div className="lpTimeframeGroup">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  className={`${activeTimeframe === tf ? "lpTfActive" : ""}`}
                  type="button"
                  onClick={() => setActiveTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
              <button className="lpCustomizeBtn" type="button">
                <Settings size={13} /> Customize
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <StatCards stats={stats} />

          {/* ── Platform sections (Clanker / Bankr) ── */}
          {(platformTokens.clanker?.length > 0 || platformTokens.bankr?.length > 0) && (
            <div className="lpPlatformSections">
              <PlatformSection
                platformKey="clanker"
                tokens={platformTokens.clanker ?? []}
                onTokenClick={handlePlatformTokenClick}
              />
              <PlatformSection
                platformKey="bankr"
                tokens={platformTokens.bankr ?? []}
                onTokenClick={handlePlatformTokenClick}
              />
            </div>
          )}

          {/* Tab bar */}
          <TabBar
            active={activeTab}
            onTabChange={setActiveTab}
            view={viewMode}
            onViewChange={setViewMode}
          />

          {/* Token table */}
          {loading ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              Loading launches…
            </div>
          ) : launches.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              No launches indexed yet — run the indexer to populate
            </div>
          ) : (
            <TokenTable tokens={launches} onRowClick={handleRowClick} />
          )}

          {/* Load more */}
          {launches.length > 0 && (
            <button className="lpLoadMore" type="button">
              Load more ↓
            </button>
          )}

          {/* Live alerts band */}
          <HotAlertsBand rawTokens={rawTokens} />
        </main>

        {/* ── Right panel ── */}
        <aside className="lpRightPanel">
          <FiltersPanel />
          <LaunchTrendsPanel rawTokens={rawTokens} />
          <LaunchQualityPanel />
          <TopByMcap rawTokens={rawTokens} />
        </aside>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default LaunchesPage;
