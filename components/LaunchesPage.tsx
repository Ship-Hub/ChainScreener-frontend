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
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "../app/launches/launches.css";
import { MobileBottomNav } from "./MobileBottomNav";
import { dispatchNavStart } from "./NavigationProgress";

// ── Shared types from market API ──────────────────────────────
export interface TokenSummary {
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
  if (v >= 1_000) {
    const k = Math.round(v / 1_000);
    return k >= 1000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${k}K`;
  }
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
    ageMinutes: token.ageMinutes,
    rawVolume: token.volume24hUsd,
    rawMcap: token.marketCapUsd,
    rawChange24h: token.priceChange24h,
    rawLiquidity: token.liquidityUsd,
  };
}

/* ══════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════ */

type Chain = "base" | "eth" | "bsc" | "arb" | "sol";
type RiskLevel = "Low" | "Medium" | "High" | "Very High";
type Tab = "all" | "new-pairs" | "fair-launch" | "presale" | "graduated" | "dex-launch";
type Timeframe = "5M" | "15M" | "1H" | "6H" | "24H" | "7D";
type SortMode = "newest" | "volume" | "gainers" | "mcap";
type ViewMode = "grid" | "list";
type RiskFilter = "All" | "Low" | "Medium" | "High" | "Scam";
type ChainFilter = "all" | "base" | "eth" | "bsc";

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
  // Raw numeric fields for client-side filtering & sorting
  ageMinutes: number;
  rawVolume: number;
  rawMcap: number;
  rawChange24h: number;
  rawLiquidity: number;
}

// Chain → block explorer base URL
function explorerUrl(chain: string, address: string): string {
  const bases: Record<string, string> = {
    base: "https://basescan.org/address/",
    eth:  "https://etherscan.io/address/",
    bsc:  "https://bscscan.com/address/",
    arb:  "https://arbiscan.io/address/",
    sol:  "https://solscan.io/account/",
  };
  return `${bases[chain] ?? "https://basescan.org/address/"}${address}`;
}


/* ══════════════════════════════════════════════════════════
   Sidebar nav config
══════════════════════════════════════════════════════════ */

const NAV_SECTIONS = [
  {
    title: "",
    items: [
      { label: "Radar",         icon: Radar,            route: "/"             },
      { label: "Launches",      icon: Activity,         route: "/launches",      active: true },
      { label: "Watchlist",     icon: Star,             route: "/watchlist"    },
      { label: "Opportunities", icon: Gem,              route: "/opportunities" },
      { label: "Alerts",        icon: Bell,             route: "/alerts"       },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money",     icon: Zap,       route: "/smart-money"     },
      { label: "Wallet Explorer", icon: Wallet,    route: "/wallet-explorer" },
      { label: "Holder Analysis", icon: Crosshair, route: "/holder-analysis" },
      { label: "Risk Scanner",    icon: Shield,    route: "/risk-scanner"    },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools",         icon: Layers,          route: "/dex-pools"          },
      { label: "Liquidity Locks",   icon: Lock,            route: "/liquidity-locks"    },
      { label: "Contract Analyzer", icon: Database,        route: "/contract-analyzer"  },
      { label: "Top Gainers",       icon: TrendingUp,      route: "/top-gainers"        },
      { label: "Top Volume",        icon: CircleDollarSign,route: "/top-volume"         },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings",      icon: Settings, route: "/settings"   },
      { label: "API Access",    icon: KeyRound, route: "/api-access"  },
      { label: "Documentation", icon: BookOpen, route: "/docs"        },
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

function TopNavbar({
  searchQuery,
  onSearchChange,
  alertCount,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  alertCount: number;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb"><Radar size={22} /></span>
        <div><strong>Chain Screener</strong><span>Launch radar</span></div>
      </div>
      <label className="commandSearch">
        <Search size={18} />
        <input
          ref={searchRef}
          placeholder="Search token, wallet, contract, or address..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        <kbd>⌘ K</kbd>
      </label>
      <div className="topActions">
        <button className="topButton" type="button">
          <Bell size={16} /> Alerts {alertCount > 0 && <span>{alertCount}</span>}
        </button>
        <button className="topButton" type="button"><Star size={16} /> Watchlist</button>
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {connected && (
                  <button className="walletButton" type="button" onClick={openChainModal} style={{ padding: "0 8px", gap: 5 }}>
                    {chain.hasIcon && chain.iconUrl && (
                      <img src={chain.iconUrl} alt={chain.name} style={{ width: 16, height: 16, borderRadius: "50%" }} />
                    )}
                    {chain.name}
                  </button>
                )}
                <button className="walletButton" type="button" onClick={connected ? openAccountModal : openConnectModal}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "oklch(0.22 0.07 260)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "oklch(0.78 0.14 260)" }}>
                    {connected ? account.displayName.slice(0, 2).toUpperCase() : "0x"}
                  </span>
                  {connected ? account.displayName : "Connect Wallet"}
                  <ChevronDown size={15} />
                </button>
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════
   Sidebar
══════════════════════════════════════════════════════════ */

function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => { setPendingRoute(null); }, [pathname]);

  const navigate = (route: string) => {
    if (pendingRoute) return;
    setPendingRoute(route);
    dispatchNavStart();
    router.push(route);
  };

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
              const isActive  = "active" in item && item.active;
              const isPending = "route" in item && pendingRoute === item.route;
              return (
                <button
                  className={`sideNavItem${isActive ? " active" : ""}${isPending ? " pending" : ""}`}
                  key={item.label}
                  type="button"
                  aria-busy={isPending || undefined}
                  onClick={() => {
                    if ("route" in item && item.route) navigate(item.route);
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

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "newest",  label: "Newest" },
  { value: "volume",  label: "Volume" },
  { value: "gainers", label: "Top Gainers" },
  { value: "mcap",    label: "Market Cap" },
];

const CHAIN_OPTIONS: Array<{ value: ChainFilter; label: string }> = [
  { value: "all",  label: "All"  },
  { value: "base", label: "BASE" },
  { value: "eth",  label: "ETH"  },
  { value: "bsc",  label: "BSC"  },
];

function TabBar({
  active, onTabChange, view, onViewChange, sort, onSortChange, chain, onChainChange, children,
}: {
  active: Tab; onTabChange: (t: Tab) => void;
  view: ViewMode; onViewChange: (v: ViewMode) => void;
  sort: SortMode; onSortChange: (s: SortMode) => void;
  chain: ChainFilter; onChainChange: (c: ChainFilter) => void;
  children?: React.ReactNode;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const currentLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Newest";

  return (
    <div className="lpTabBar" style={{ flexWrap: "wrap", gap: 8 }}>
      {/* Chain filter pills — prominent, above/beside the tabs */}
      <div className="lpChainGroup">
        {CHAIN_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`lpChainPill${chain === value ? " lpChainPillActive" : ""}${value !== "all" ? ` lpChainPill--${value}` : ""}`}
            onClick={() => onChainChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lpTabGroup">
        {TABS.map((tab) => (
          <button key={tab.id} className={`lpTab ${active === tab.id ? "lpTabActive" : ""}`} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="lpTabRight">
        <div style={{ position: "relative" }}>
          <button className="lpSortSelect" type="button" onClick={() => setSortOpen(o => !o)}>
            {currentLabel} <ChevronDown size={13} />
          </button>
          {sortOpen && (
            <div className="radarDropdown" style={{ minWidth: 140 }} onMouseLeave={() => setSortOpen(false)}>
              {SORT_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button" className={`radarDropdownItem ${sort === value ? "selected" : ""}`}
                  onClick={() => { onSortChange(value); setSortOpen(false); }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lpViewToggle">
          <button className={view === "grid" ? "lpViewActive" : ""} type="button" aria-label="Grid view" onClick={() => onViewChange("grid")}><Grid size={14} /></button>
          <button className={view === "list" ? "lpViewActive" : ""} type="button" aria-label="List view" onClick={() => onViewChange("list")}><List size={14} /></button>
        </div>
        {children}
      </div>
    </div>
    );
  }

/* ══════════════════════════════════════════════════════════
   Token table
══════════════════════════════════════════════════════════ */

const ALL_COLUMNS = ["Platform", "Launched", "Age", "Market Cap", "Volume", "Liquidity", "Smart Score"] as const;
type ColumnKey = typeof ALL_COLUMNS[number];

function TokenTable({
  tokens, onRowClick, starred, onToggleStar, onChartClick, hiddenCols,
}: {
  tokens: TokenLaunch[];
  onRowClick: (token: TokenLaunch) => void;
  starred: Record<string, boolean>;
  onToggleStar: (id: string) => void;
  onChartClick: (token: TokenLaunch) => void;
  hiddenCols: Set<ColumnKey>;
}) {
  const show = (col: ColumnKey) => !hiddenCols.has(col);
  const toggleStar = (e: React.MouseEvent, id: string) => { e.stopPropagation(); onToggleStar(id); };

  return (
    <div className="lpTableWrap">
      <table className="lpTable">
        <thead>
          <tr>
            <th>☆</th>
            <th>Token / Pair</th>
            <th>Chain</th>
            {show("Platform")    && <th>Platform</th>}
            {show("Launched")    && <th>Launched</th>}
            {show("Age")         && <th>Age</th>}
            {show("Market Cap")  && <th>Market Cap</th>}
            {show("Volume")      && <th>Volume (24H)</th>}
            {show("Liquidity")   && <th>Liquidity</th>}
            {show("Smart Score") && <th>Smart Score</th>}
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id} onClick={() => onRowClick(token)}>
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
              <td>
                <span className={`lpChainBadge ${token.chain}`}>
                  {token.chain === "eth" ? "ETH" : token.chain.toUpperCase()}
                </span>
              </td>
              {show("Platform")    && <td><PlatformBadge platform={token.launchPlatform} /></td>}
              {show("Launched")    && <td style={{ color: "var(--muted)", fontSize: 11 }}>{token.launchedAt}</td>}
              {show("Age")         && <td style={{ color: "var(--faint)", fontSize: 11 }}>{token.age}</td>}
              {show("Market Cap")  && <td style={{ color: "var(--text)", fontWeight: 700 }}>{token.marketCap}</td>}
              {show("Volume")      && <td style={{ color: "var(--text)" }}>{token.volume24h}</td>}
              {show("Liquidity")   && (
                <td>
                  <div className="lpLiqCell">
                    {token.liquidity}
                    {token.liquidityLocked
                      ? <Lock size={12} className="lpLockIcon" aria-label="Liquidity locked" />
                      : <AlertTriangle size={12} className="lpWarnIcon" aria-label="Liquidity unlocked" />}
                  </div>
                </td>
              )}
              {show("Smart Score") && (
                <td><div className="lpScoreCell"><SmartScoreGauge score={token.smartScore} /></div></td>
              )}
              <td><RiskBadge level={token.risk} /></td>
              <td>
                <div className="lpActions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`lpActionBtn ${starred[token.id] ? "lpStarred" : ""}`}
                    type="button" aria-label="Favourite"
                    onClick={(e) => toggleStar(e, token.id)}
                  >
                    <Star size={12} fill={starred[token.id] ? "currentColor" : "none"} />
                  </button>
                  <a
                    className="lpActionBtn"
                    href={explorerUrl(token.chain, token.address)}
                    target="_blank" rel="noopener noreferrer"
                    aria-label="View on explorer"
                    style={{ display: "grid", placeItems: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} />
                  </a>
                  <button className="lpActionBtn" type="button" aria-label="View chart"
                    onClick={(e) => { e.stopPropagation(); onChartClick(token); }}>
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

function GridView({
  tokens, onRowClick, starred, onToggleStar,
}: {
  tokens: TokenLaunch[];
  onRowClick: (token: TokenLaunch) => void;
  starred: Record<string, boolean>;
  onToggleStar: (id: string) => void;
}) {
  return (
    <div className="lpGridView">
      {tokens.map(token => (
        <button key={token.id} className="lpGridCard" type="button" onClick={() => onRowClick(token)}>
          <div className="lpGridCardHead">
            <span className={`lpTokenLogo ${token.logoPalette}`}>{token.symbol.slice(0, 2).toUpperCase()}</span>
            <div className="lpGridCardTitle">
              <strong>{token.symbol}</strong>
              <span>{token.pair}</span>
            </div>
            <button
              className={`lpStarBtn ${starred[token.id] ? "lpStarred" : ""}`}
              type="button"
              onClick={e => { e.stopPropagation(); onToggleStar(token.id); }}
              aria-label="Star"
            >
              <Star size={13} fill={starred[token.id] ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="lpGridCardRow">
            <span className={`lpChainBadge ${token.chain}`}>{token.chain === "eth" ? "ETH" : token.chain.toUpperCase()}</span>
            <RiskBadge level={token.risk} />
          </div>
          <div className="lpGridCardStats">
            <div><span>MCap</span><strong>{token.marketCap}</strong></div>
            <div><span>Vol 24H</span><strong>{token.volume24h}</strong></div>
            <div><span>Liq</span><strong>{token.liquidity}</strong></div>
          </div>
          <div className="lpGridCardFoot">
            <SmartScoreGauge score={token.smartScore} />
            <span style={{ color: "var(--faint)", fontSize: 11 }}>{token.age}</span>
          </div>
        </button>
      ))}
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
  const router = useRouter();
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
      <button className="lpAlertViewAll" type="button" onClick={() => router.push("/alerts")}>
        View all alerts <ArrowRight size={13} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Filters
══════════════════════════════════════════════════════════ */

interface FilterState {
  riskLevels: Set<string>;
  minLiquidity: number;
  hideScams: boolean;
  chain: string;
}

function FiltersPanel({
  filterState, onFilterChange, onReset,
}: {
  filterState: FilterState;
  onFilterChange: (next: Partial<FilterState>) => void;
  onReset: () => void;
}) {
  const [minLiqInput, setMinLiqInput] = useState(filterState.minLiquidity > 0 ? String(filterState.minLiquidity) : "");
  const chainOptions = ["all", "base", "eth", "bsc"];
  const riskOptions: Array<{ value: string; label: string }> = [
    { value: "Low", label: "Low" }, { value: "Medium", label: "Medium" },
    { value: "High", label: "High" }, { value: "Very High", label: "Very High" },
  ];

  const activeCount = (filterState.riskLevels.size > 0 ? 1 : 0) +
    (filterState.minLiquidity > 0 ? 1 : 0) +
    (filterState.hideScams ? 1 : 0) +
    (filterState.chain !== "all" ? 1 : 0);

  const toggleRisk = (value: string) => {
    const next = new Set(filterState.riskLevels);
    next.has(value) ? next.delete(value) : next.add(value);
    onFilterChange({ riskLevels: next });
  };

  return (
    <div className="lpFilterPanel">
      <div className="lpPanelHead">
        <h3>Filters {activeCount > 0 && <span style={{ color: "var(--cyan)", fontWeight: 700 }}>({activeCount})</span>}</h3>
        <button className="lpPanelResetLink" type="button" onClick={onReset}>Reset</button>
      </div>
      <div className="lpPanelBody">
        {/* Chain */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Chain <Info size={11} className="lpInfoIcon" /></label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {chainOptions.map(c => (
              <button key={c} type="button"
                className={`lpRiskBtn ${filterState.chain === c ? "lpRiskActive" : ""}`}
                onClick={() => onFilterChange({ chain: c })}>
                {c === "all" ? "All" : c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Level */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Risk Level</label>
          <div className="lpRiskGroup">
            {riskOptions.map(({ value, label }) => (
              <button key={value} type="button"
                className={`lpRiskBtn ${filterState.riskLevels.has(value) ? "lpRiskActive" : ""}`}
                onClick={() => toggleRisk(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Min. Liquidity */}
        <div className="lpFilterRow">
          <label className="lpFilterLabel">Min. Liquidity</label>
          <div className="lpMinLiqInput">
            <span>$</span>
            <input
              type="number" placeholder="0" min={0} value={minLiqInput}
              onChange={e => setMinLiqInput(e.target.value)}
              onBlur={() => onFilterChange({ minLiquidity: Number(minLiqInput) || 0 })}
            />
          </div>
        </div>

        {/* Hide scams */}
        <div className="lpToggleRow">
          <span className="lpToggleLabel">Hide Very High Risk</span>
          <button
            className={`lpToggle ${filterState.hideScams ? "lpToggleOn" : ""}`}
            type="button" role="switch" aria-checked={filterState.hideScams}
            onClick={() => onFilterChange({ hideScams: !filterState.hideScams })}
          />
        </div>

        <button className="lpApplyBtn" type="button" style={{ opacity: activeCount > 0 ? 1 : 0.5 }}>
          <Filter size={14} /> {activeCount > 0 ? `Active Filters (${activeCount})` : "No Filters Applied"}
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

type TrendsTf = "1H" | "6H" | "24H" | "7D";
const TRENDS_TF_OPTIONS: TrendsTf[] = ["1H", "6H", "24H", "7D"];
const TRENDS_TF_MINS: Record<TrendsTf, number> = { "1H": 60, "6H": 360, "24H": 1440, "7D": 10_080 };

function LaunchTrendsPanel({ rawTokens }: { rawTokens: TokenSummary[] }) {
  const [tf, setTf] = useState<TrendsTf>("24H");
  const [tfOpen, setTfOpen] = useState(false);

  const filtered = rawTokens.filter(t => t.ageMinutes <= TRENDS_TF_MINS[tf]);

  const byChain = filtered.reduce<Record<string, { count: number; volume: number }>>((acc, t) => {
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

  if (rawTokens.length === 0) {
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
        <div style={{ position: "relative" }}>
          <button className="lpDropdownBtn" type="button" onClick={() => setTfOpen(o => !o)}>
            {tf} <ChevronDown size={12} />
          </button>
          {tfOpen && (
            <div className="radarDropdown" style={{ right: 0, left: "auto", minWidth: 80 }}
              onMouseLeave={() => setTfOpen(false)}>
              {TRENDS_TF_OPTIONS.map(opt => (
                <button key={opt} type="button"
                  className={`radarDropdownItem ${tf === opt ? "selected" : ""}`}
                  onClick={() => { setTf(opt); setTfOpen(false); }}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {chainList.length === 0 ? (
        <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0" }}>
          No launches in the last {tf}
        </div>
      ) : (
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
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Right panel: Launch Quality donut
══════════════════════════════════════════════════════════ */

function LaunchQualityPanel({ rawTokens }: { rawTokens: TokenSummary[] }) {
  const total = rawTokens.length || 1;
  const low     = rawTokens.filter(t => t.riskLevel === "Low").length;
  const medium  = rawTokens.filter(t => t.riskLevel === "Medium").length;
  const high    = rawTokens.filter(t => t.riskLevel === "High").length;
  const extreme = rawTokens.filter(t => t.riskLevel === "Extreme" || t.riskScore > 75).length;

  const pct = (n: number) => ((n / total) * 100).toFixed(1);
  const lowP = parseFloat(pct(low));
  const medP = parseFloat(pct(medium));
  const hiP  = parseFloat(pct(high));
  const exP  = parseFloat(pct(extreme));

  // Build conic-gradient stops
  const stops = [
    { color: "var(--green)",  end: lowP },
    { color: "var(--amber)",  end: lowP + medP },
    { color: "var(--orange)", end: lowP + medP + hiP },
    { color: "var(--red)",    end: 100 },
  ];
  const conicStops = stops.reduce<string[]>((acc, s, i) => {
    const prev = i === 0 ? 0 : stops[i - 1].end;
    if (s.end > prev) acc.push(`${s.color} ${prev}% ${s.end}%`);
    return acc;
  }, []).join(", ");

  return (
    <div className="lpQualityPanel">
      <div className="lpPanelHead">
        <h3>Launch Quality</h3>
      </div>
      <div className="lpQualityBody">
        {rawTokens.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 12 }}>No data yet</div>
        ) : (
          <>
            <div
              className="lpQualityDonut"
              aria-label="Launch quality distribution"
              style={{ background: `radial-gradient(circle, oklch(0.12 0.018 255) 0 54%, transparent 55%), conic-gradient(${conicStops || "var(--faint) 0% 100%"})` }}
            />
            <div className="lpQualityLegend">
              {[
                { color: "var(--green)",  label: "Low Risk",    p: lowP },
                { color: "var(--amber)",  label: "Medium Risk", p: medP },
                { color: "var(--orange)", label: "High Risk",   p: hiP  },
                { color: "var(--red)",    label: "Extreme",     p: exP  },
              ].map(({ color, label, p }) => (
                <div className="lpLegendItem" key={label}>
                  <span className="lpLegendDot" style={{ background: color }} />
                  <span className="lpLegendLabel">{label}</span>
                  <span className="lpLegendPct">{p.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
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

const TF_MINUTES: Record<Timeframe, number> = {
  "5M": 5, "15M": 15, "1H": 60, "6H": 360, "24H": 1440, "7D": 100_000,
};

const DEFAULT_FILTER: FilterState = {
  riskLevels: new Set(),
  minLiquidity: 0,
  hideScams: false,
  chain: "all",
};

interface LaunchesPageProps {
  /** Server-rendered initial token list (skips client-side fetch on first render). */
  initialTokens?: TokenSummary[];
  /** Server-rendered platform token map (clanker / bankr / …). */
  initialPlatformTokens?: Record<string, TokenSummary[]>;
}

const PAGE_SIZE = 100;

export function LaunchesPage({ initialTokens = [], initialPlatformTokens = {} }: LaunchesPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("24H");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortMode>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  // Pre-populate from SSR props so the page is never blank on first paint.
  const [rawTokens, setRawTokens] = useState<TokenSummary[]>(initialTokens);
  const [platformTokens, setPlatformTokens] = useState<Record<string, TokenSummary[]>>(initialPlatformTokens);
  const [loading, setLoading] = useState(initialTokens.length === 0);
  // Pagination: nextOffset = how many tokens we've accumulated; hasMore = whether API has more.
  const [nextOffset, setNextOffset] = useState(initialTokens.length);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [showCustomize, setShowCustomize] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<ColumnKey>>(new Set());

  const hasInitialData = useRef(initialTokens.length > 0);
  // Keeps track of the chain that was used for the last API fetch so chain-change
  // effect can tell whether this is a real change vs. the initial render.
  const activeChainRef = useRef<string>(filterState.chain);

  // Starred — localStorage persistence
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { const s = localStorage.getItem("cs:launches:starred"); if (s) setStarred(JSON.parse(s)); } catch {}
  }, []);
  const toggleStar = useCallback((id: string) => {
    setStarred(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("cs:launches:starred", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const timeframes: Timeframe[] = ["5M", "15M", "1H", "6H", "24H", "7D"];

  // ─── Core fetch helper ─────────────────────────────────────────────────────
  // offset=0 → first page / background refresh (smart-merge: updates existing rows,
  //             prepends brand-new ones — never wipes the list the user is reading).
  // offset>0 → append-only "Load More" pagination.
  const fetchPage = useCallback((offset: number, chain: string, showSpinner = false) => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const chainParam = chain !== "all" ? `&chain=${chain}` : "";
    const url = `${api}/api/launches?offset=${offset}&limit=${PAGE_SIZE}&maxAgeDays=7&minVolume=10${chainParam}`;

    if (offset === 0 && showSpinner) setLoading(true);
    if (offset > 0) setLoadingMore(true);

    fetch(url)
      .then(r => r.json())
      .then((json: { data?: TokenSummary[]; hasMore?: boolean }) => {
        const fresh: TokenSummary[] = json.data ?? [];
        setHasMore(json.hasMore ?? fresh.length >= PAGE_SIZE);

        if (offset === 0) {
          // Smart merge — background refresh never blanks what the user already sees.
          setRawTokens(prev => {
            const freshMap = new Map(fresh.map(t => [`${t.chain}:${t.address}`, t]));
            const existingKeys = new Set(prev.map(t => `${t.chain}:${t.address}`));
            const brandNew = fresh.filter(t => !existingKeys.has(`${t.chain}:${t.address}`));
            const updated  = prev.map(t => freshMap.get(`${t.chain}:${t.address}`) ?? t);
            return [...brandNew, ...updated];
          });
          setNextOffset(prev => Math.max(prev, fresh.length));
        } else {
          // Append, deduplicated.
          setRawTokens(prev => {
            const existingKeys = new Set(prev.map(t => `${t.chain}:${t.address}`));
            return [...prev, ...fresh.filter(t => !existingKeys.has(`${t.chain}:${t.address}`))];
          });
          setNextOffset(prev => prev + fresh.length);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (offset === 0 && showSpinner) setLoading(false);
        if (offset > 0) setLoadingMore(false);
      });
  }, []);

  // ─── Initial load + background refresh ────────────────────────────────────
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    if (!hasInitialData.current) {
      fetchPage(0, filterState.chain, true);
    }

    // Platform strip and alert count — one-shot, no spinner
    fetch(`${api}/api/launches/by-platform`)
      .then(r => r.json()).then(d => setPlatformTokens(d ?? {})).catch(() => {});
    fetch(`${api}/api/alerts/counts`)
      .then(r => r.json())
      .then(d => {
        const counts = d.data ?? d ?? {};
        setAlertCount(Object.values(counts as Record<string, number>).reduce((s, n) => s + n, 0));
      }).catch(() => {});

    // Silent background refresh every 30 s — smart merge keeps existing rows visible.
    const interval = setInterval(() => fetchPage(0, activeChainRef.current), 30_000);
    return () => clearInterval(interval);
  // fetchPage is stable (useCallback with no deps that change); suppress exhaustive-deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Chain filter change: clear list, reset offset, re-fetch page 1 ───────
  useEffect(() => {
    if (activeChainRef.current === filterState.chain) return; // skip on initial mount
    activeChainRef.current = filterState.chain;
    setRawTokens([]);
    setNextOffset(0);
    setHasMore(true);
    fetchPage(0, filterState.chain, true);
  }, [filterState.chain, fetchPage]);

  const allLaunches = useMemo(() => rawTokens.map(summaryToLaunch), [rawTokens]);

  // Full filtered + sorted list
  const filteredLaunches = useMemo(() => {
    let list = allLaunches;

    // Timeframe
    const maxAge = TF_MINUTES[activeTimeframe];
    list = list.filter(t => t.ageMinutes <= maxAge);

    // Tab
    if (activeTab === "new-pairs")   list = list.filter(t => t.ageMinutes < 120);
    if (activeTab === "fair-launch") list = list.filter(t => !t.launchPlatform);
    if (activeTab === "graduated")   list = list.filter(t => t.ageMinutes > 1440);
    // presale / dex-launch: coming soon — show empty

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
      );
    }

    // Risk levels
    if (filterState.riskLevels.size > 0)
      list = list.filter(t => filterState.riskLevels.has(t.risk));

    // Hide very high risk
    if (filterState.hideScams) list = list.filter(t => t.risk !== "Very High");

    // Min liquidity
    if (filterState.minLiquidity > 0) list = list.filter(t => t.rawLiquidity >= filterState.minLiquidity);

    // Chain
    if (filterState.chain !== "all") list = list.filter(t => t.chain === filterState.chain);

    // Sort
    if (sort === "volume")  list = [...list].sort((a, b) => b.rawVolume - a.rawVolume);
    if (sort === "gainers") list = [...list].sort((a, b) => b.rawChange24h - a.rawChange24h);
    if (sort === "mcap")    list = [...list].sort((a, b) => b.rawMcap - a.rawMcap);
    if (sort === "newest")  list = [...list].sort((a, b) => a.ageMinutes - b.ageMinutes);

    return list;
  }, [allLaunches, activeTab, activeTimeframe, searchQuery, filterState, sort]);

  // All filtered tokens — rendered in full (no client-side page limit; pagination is API-side).
  const displayedLaunches = filteredLaunches;

  const stats: LaunchStats = {
    total: rawTokens.length,
    safe: rawTokens.filter(t => t.riskLevel === "Low").length,
    highRisk: rawTokens.filter(t => t.riskLevel === "High").length,
    veryHigh: rawTokens.filter(t => t.riskLevel === "Extreme" || t.riskScore > 75).length,
    totalVolume: rawTokens.reduce((s, t) => s + t.volume24hUsd, 0),
    avgAgeMinutes: rawTokens.length > 0 ? Math.round(rawTokens.reduce((s, t) => s + t.ageMinutes, 0) / rawTokens.length) : 0,
  };

  const handleRowClick = (token: TokenLaunch) => { dispatchNavStart(); router.push(`/token/${token.chain}/${token.address}`); };
  const handlePlatformTokenClick = (address: string, chain: string) => { dispatchNavStart(); router.push(`/token/${chain}/${address}`); };

  const updateFilter = useCallback((partial: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTER);
  }, []);

  const isComingSoon = activeTab === "presale" || activeTab === "dex-launch";

  return (
    <div className="appShell">
      <TopNavbar searchQuery={searchQuery} onSearchChange={q => setSearchQuery(q)} alertCount={alertCount} />
      <div className="lpShell">
        <Sidebar />
        <main className="lpMain">
          <div className="lpHeader">
            <div className="lpHeaderLeft">
              <h1>Launches</h1>
              <p>Track new token launches across all chains in real-time.</p>
            </div>
            <div className="lpTimeframeGroup">
              {timeframes.map((tf) => (
                <button key={tf} className={activeTimeframe === tf ? "lpTfActive" : ""} type="button"
                  onClick={() => setActiveTimeframe(tf)}>
                  {tf}
                </button>
              ))}
              <button
                className={`lpCustomizeBtn ${showCustomize ? "active" : ""}`}
                type="button"
                onClick={() => setShowCustomize(v => !v)}
              >
                <Settings size={13} /> Customize
              </button>
            </div>
          </div>

          {/* Column visibility picker */}
          {showCustomize && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
              padding: "10px 14px", marginBottom: 8,
              background: "oklch(0.14 0.04 255)",
              border: "1px solid oklch(0.28 0.06 255 / 0.5)",
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4, fontWeight: 600 }}>
                Columns:
              </span>
              {ALL_COLUMNS.map((col) => {
                const visible = !hiddenCols.has(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setHiddenCols(prev => {
                      const next = new Set(prev);
                      visible ? next.add(col) : next.delete(col);
                      return next;
                    })}
                    style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                      border: `1px solid ${visible ? "oklch(0.55 0.18 210 / 0.6)" : "oklch(0.3 0.05 255 / 0.4)"}`,
                      background: visible ? "oklch(0.22 0.07 210 / 0.4)" : "transparent",
                      color: visible ? "oklch(0.82 0.14 210)" : "var(--faint)",
                    }}
                  >
                    {visible ? "✓ " : ""}{col}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setHiddenCols(new Set())}
                style={{
                  marginLeft: "auto", fontSize: 11, color: "var(--faint)", background: "none",
                  border: "none", cursor: "pointer", textDecoration: "underline",
                }}
              >
                Reset
              </button>
            </div>
          )}

          <StatCards stats={stats} />

          {(platformTokens.clanker?.length > 0 || platformTokens.bankr?.length > 0) && (
            <div className="lpPlatformSections">
              <PlatformSection platformKey="clanker" tokens={platformTokens.clanker ?? []} onTokenClick={handlePlatformTokenClick} />
              <PlatformSection platformKey="bankr"   tokens={platformTokens.bankr   ?? []} onTokenClick={handlePlatformTokenClick} />
            </div>
          )}

          <TabBar
            active={activeTab} onTabChange={t => setActiveTab(t)}
            view={viewMode} onViewChange={setViewMode}
            sort={sort} onSortChange={setSort}
            chain={filterState.chain as ChainFilter}
            onChainChange={c => updateFilter({ chain: c })}
          >
            <button
              className="lpMobileFilterBtn"
              type="button"
              onClick={() => setShowMobileFilter(true)}
            >
              <Filter size={14} /> Filters
            </button>
          </TabBar>

          {/* Mobile filter drawer */}
          {showMobileFilter && (
            <div className="lpFilterDrawer open" onClick={(e) => { if (e.target === e.currentTarget) setShowMobileFilter(false); }}>
              <div className="lpFilterDrawerHeader">
                <h3>Filters</h3>
                <button className="lpFilterDrawerClose" type="button" onClick={() => setShowMobileFilter(false)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
              <FiltersPanel filterState={filterState} onFilterChange={updateFilter} onReset={resetFilters} />
              <button className="lpApplyBtn" type="button" onClick={() => setShowMobileFilter(false)}>Apply Filters</button>
            </div>
          )}

          {loading ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>Loading launches…</div>
          ) : isComingSoon ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
              <strong style={{ color: "var(--muted)" }}>Coming Soon</strong>
              <p style={{ margin: "8px 0 0", fontSize: 12 }}>This tab requires additional indexer data</p>
            </div>
          ) : displayedLaunches.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              {allLaunches.length === 0 ? "No launches indexed yet — run the indexer to populate" : "No tokens match the current filters"}
            </div>
          ) : viewMode === "grid" ? (
            <GridView tokens={displayedLaunches} onRowClick={handleRowClick} starred={starred} onToggleStar={toggleStar} />
          ) : (
            <TokenTable tokens={displayedLaunches} onRowClick={handleRowClick}
              starred={starred} onToggleStar={toggleStar} onChartClick={handleRowClick}
              hiddenCols={hiddenCols} />
          )}

          {/* Load More — fetches the next page from the API (not a client-side slice) */}
          {hasMore && !loading && (
            <button
              className="lpLoadMore"
              type="button"
              disabled={loadingMore}
              onClick={() => fetchPage(nextOffset, filterState.chain)}
            >
              {loadingMore ? "Loading…" : `Load older launches ↓`}
            </button>
          )}

          <HotAlertsBand rawTokens={rawTokens} />
        </main>

        <aside className="lpRightPanel">
          <FiltersPanel filterState={filterState} onFilterChange={updateFilter} onReset={resetFilters} />
          <LaunchTrendsPanel rawTokens={rawTokens} />
          <LaunchQualityPanel rawTokens={rawTokens} />
          <TopByMcap rawTokens={rawTokens} />
        </aside>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default LaunchesPage;
