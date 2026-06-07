"use client";

import {
  Activity,
  ArrowRight,
  BarChart2,
  Bell,
  BookOpen,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Flame,
  Gem,
  Hexagon,
  KeyRound,
  Layers,
  Lock,
  Radar,
  Search,
  Settings,
  Shield,
  Sliders,
  Star,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import "../app/top-gainers/top-gainers.css";
import { MobileBottomNav } from "./MobileBottomNav";

// ── Shared API type ───────────────────────────────────────────
interface TokenSummary {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange1h?: number;
  priceChange5m?: number;
  volume24hUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  buys: number;
  sells: number;
  ageMinutes: number;
  riskLevel: string;
  trendingScore: number;
  lastActivityAt: string;
}

// ── Formatting helpers ────────────────────────────────────────
function fmtUsd(v: number): string {
  if (v <= 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtPrice(p: number): string {
  if (p === 0) return "—";
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(4)}`;
}

function chainTone(chain: string): string {
  const map: Record<string, string> = { base: "blue", eth: "violet", bsc: "amber" };
  return map[chain] ?? "cyan";
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Timeframe = "5M" | "15M" | "1H" | "6H" | "24H" | "7D";
type Chain = "All Chains" | "Base" | "Ethereum" | "BSC";

// Maps UI chain label → API key (only supported chains)
const CHAIN_API_KEY: Partial<Record<Chain, string>> = {
  "Base": "base",
  "Ethereum": "eth",
  "BSC": "bsc",
};

function getPctChange(t: TokenSummary, tf: Timeframe): number {
  if (tf === "5M" || tf === "15M") return t.priceChange5m ?? t.priceChange24h;
  if (tf === "1H")                  return t.priceChange1h  ?? t.priceChange24h;
  return t.priceChange24h;
}

function pctLabel(tf: Timeframe): string {
  if (tf === "5M")  return "5M %";
  if (tf === "15M") return "15M %";
  if (tf === "1H")  return "1H %";
  if (tf === "6H")  return "24H %";
  if (tf === "7D")  return "24H %";
  return "24H %";
}

interface GainerRow {
  rank: number;
  name: string;
  pair: string;
  price: string;
  change: string;
  volume24h: string;
  liquidity: string;
  mcap: string;
  tone: string;
  chain: "base" | "eth" | "bsc" | "sol";
  address: string;
  sparkPoints: string;
}

interface VolumeRow {
  rank: number;
  name: string;
  pair: string;
  price: string;
  volume24h: string;
  volumePct: number;
  trades: string;
  liquidity: string;
  tone: string;
  chain: "base" | "eth" | "bsc" | "sol";
  address: string;
}

function summaryToGainer(t: TokenSummary, rank: number, tf: Timeframe): GainerRow {
  const pct = getPctChange(t, tf);
  const up = pct >= 0;
  return {
    rank,
    name: t.symbol,
    pair: `${t.symbol}/WETH`,
    price: fmtPrice(t.priceUsd),
    change: `${up ? "+" : ""}${pct.toFixed(2)}%`,
    volume24h: fmtUsd(t.volume24hUsd),
    liquidity: fmtUsd(t.liquidityUsd),
    mcap: fmtUsd(t.marketCapUsd),
    tone: chainTone(t.chain),
    chain: t.chain as "base" | "eth" | "bsc" | "sol",
    address: t.address,
    sparkPoints: up
      ? "2,22 10,18 20,14 30,10 40,7 50,5 60,3 68,2"
      : "2,2 10,6 20,10 30,14 40,18 50,20 60,22 68,24",
  };
}

function summaryToVolume(t: TokenSummary, rank: number, totalVol: number): VolumeRow {
  return {
    rank,
    name: t.symbol,
    pair: `${t.symbol}/WETH`,
    price: fmtPrice(t.priceUsd),
    volume24h: fmtUsd(t.volume24hUsd),
    volumePct: totalVol > 0 ? (t.volume24hUsd / totalVol) * 100 : 0,
    trades: (t.buys + t.sells).toLocaleString(),
    liquidity: fmtUsd(t.liquidityUsd),
    tone: chainTone(t.chain),
    chain: t.chain as "base" | "eth" | "bsc" | "sol",
    address: t.address,
  };
}

// ─────────────────────────────────────────────────────────────
// Navigation config
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
      { label: "Smart Money",     icon: Zap,              route: "/smart-money" },
      { label: "Wallet Explorer", icon: Wallet,           route: "/wallet-explorer" },
      { label: "Holder Analysis", icon: Crosshair,        route: "/holder-analysis" },
      { label: "Risk Scanner",    icon: Shield,           route: "/risk-scanner" },
      { label: "Top Gainers",     icon: TrendingUp,       route: "/top-gainers", active: true },
      { label: "Top Volume",      icon: CircleDollarSign, route: "/top-volume" },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools",         icon: Layers,   route: "/dex-pools" },
      { label: "Liquidity Locks",   icon: Lock,     route: "/liquidity-locks" },
      { label: "Contract Analyzer", icon: Database, route: "/contract-analyzer" },
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

// Only chains that actually exist in the indexer DB
const chainTabs: { label: Chain; dotClass?: string }[] = [
  { label: "All Chains" },
  { label: "Base",      dotClass: "blue" },
  { label: "Ethereum",  dotClass: "purple" },
  { label: "BSC",       dotClass: "yellow" },
];

// ─────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────
function TokenLogo({ tone }: { tone: string }) {
  return (
    <span className={`tgTokenLogo ${tone}`}>
      <Hexagon size={14} />
    </span>
  );
}

function Sparkline({ points, tone }: { points: string; tone: string }) {
  return (
    <svg className={`tgSparkline ${tone}`} viewBox="0 0 68 26" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function InsightSparkline({ points, tone }: { points: string; tone: string }) {
  return (
    <svg className={`tgInsightSparkline ${tone}`} viewBox="0 0 58 22" aria-hidden="true">
      <polyline points={points} />
    </svg>
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
          <span>Multi-Chain Analytics</span>
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
          <span className="tokenLogo blue" style={{ width: 24, height: 24, fontSize: 8 }}>
            <Hexagon size={12} />
          </span>
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
function TgSidebar() {
  const router = useRouter();
  return (
    <aside className="tgSidebar">
      <nav aria-label="Top Gainers navigation">
        {navSections.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? (
              <span className="navSectionTitle">{section.title}</span>
            ) : null}
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
        <strong>
          <Gem size={16} /> Go Pro
        </strong>
        <p>Real-time gainers alerts, custom filters, and unlimited scans.</p>
        <button type="button">
          Upgrade Now <ArrowRight size={15} />
        </button>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Top Gainers Table
// ─────────────────────────────────────────────────────────────
const GAINER_PREVIEW = 10;

function TopGainersTable({
  rows,
  starred,
  onToggleStar,
  loading,
  timeframe,
}: {
  rows: GainerRow[];
  starred: Set<string>;
  onToggleStar: (key: string) => void;
  loading: boolean;
  timeframe: Timeframe;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? rows : rows.slice(0, GAINER_PREVIEW);

  return (
    <div className="tgTablePanel">
      <div className="tgTableHead">
        <div className="tgTableHeadLeft">
          <TrendingUp size={14} style={{ color: "var(--green)" }} />
          <span className="tgTableTitle">Top Gainers</span>
          <span className="tgInfoIcon" title={`Tokens ranked by ${pctLabel(timeframe)} price change`}>i</span>
        </div>
        <span className="tgDropdownBtn" style={{ cursor: "default" }}>
          {pctLabel(timeframe)}
        </span>
      </div>

      <div className="tgTableWrap">
        <table className="tgTable">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Token</th>
              <th>Price</th>
              <th>{pctLabel(timeframe)}</th>
              <th>Volume (24H)</th>
              <th>Liquidity</th>
              <th>MCap</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--faint)", padding: "24px 0" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--faint)", padding: "24px 0" }}>No data yet — run indexer</td></tr>
            ) : displayed.map((row) => {
              const key = `g-${row.rank}`;
              const isPos = row.change.startsWith("+");
              return (
                <tr key={row.rank} onClick={() => router.push(`/token/${row.chain}/${row.address}`)}>
                  <td><span className="tgRank">{row.rank}</span></td>
                  <td>
                    <button
                      className={`tgStarBtn ${starred.has(key) ? "tgStarred" : ""}`}
                      type="button"
                      aria-label={starred.has(key) ? "Unfavorite" : "Favorite"}
                      onClick={(e) => { e.stopPropagation(); onToggleStar(key); }}
                    >
                      <Star size={13} />
                    </button>
                  </td>
                  <td>
                    <div className="tgTokenCell">
                      <TokenLogo tone={row.tone} />
                      <div className="tgTokenInfo">
                        <span className="tgTokenName">{row.name}</span>
                        <span className="tgTokenPair">{row.pair}</span>
                      </div>
                      <span className={`tgChainBadge ${row.chain}`}>
                        {row.chain === "base" ? "Base" : row.chain === "eth" ? "ETH" : row.chain === "bsc" ? "BSC" : "SOL"}
                      </span>
                    </div>
                  </td>
                  <td><span className="tgPrice">{row.price}</span></td>
                  <td><span className={isPos ? "tgChangePos" : "tgChangeNeg"}>{row.change}</span></td>
                  <td><span className="tgVolume">{row.volume24h}</span></td>
                  <td><span className="tgLiq">{row.liquidity}</span></td>
                  <td><span className="tgMcap">{row.mcap}</span></td>
                  <td><Sparkline points={row.sparkPoints} tone={isPos ? "green" : "red"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > GAINER_PREVIEW && (
        <button className="tgViewAllBtn" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse" : `View All Gainers (${rows.length})`} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top Volume Table
// ─────────────────────────────────────────────────────────────
const VOLUME_PREVIEW = 10;

function TopVolumeTable({
  rows,
  starred,
  onToggleStar,
  loading,
}: {
  rows: VolumeRow[];
  starred: Set<string>;
  onToggleStar: (key: string) => void;
  loading: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? rows : rows.slice(0, VOLUME_PREVIEW);

  return (
    <div className="tgTablePanel">
      <div className="tgTableHead">
        <div className="tgTableHeadLeft">
          <BarChart2 size={14} style={{ color: "var(--violet)" }} />
          <span className="tgTableTitle">Top Volume</span>
          <span className="tgInfoIcon" title="Tokens ranked by 24h trading volume">i</span>
        </div>
        <span className="tgDropdownBtn" style={{ cursor: "default" }}>24H Vol</span>
      </div>

      <div className="tgTableWrap">
        <table className="tgTable">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Token</th>
              <th>Price</th>
              <th style={{ minWidth: 120 }}>24H Volume ↓</th>
              <th style={{ minWidth: 120 }}>Volume %</th>
              <th>Trades</th>
              <th>Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--faint)", padding: "24px 0" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--faint)", padding: "24px 0" }}>No data yet — run indexer</td></tr>
            ) : displayed.map((row) => {
              const key = `v-${row.rank}`;
              return (
                <tr key={row.rank} onClick={() => router.push(`/token/${row.chain}/${row.address}`)}>
                  <td><span className="tgRank">{row.rank}</span></td>
                  <td>
                    <button
                      className={`tgStarBtn ${starred.has(key) ? "tgStarred" : ""}`}
                      type="button"
                      aria-label={starred.has(key) ? "Unfavorite" : "Favorite"}
                      onClick={(e) => { e.stopPropagation(); onToggleStar(key); }}
                    >
                      <Star size={13} />
                    </button>
                  </td>
                  <td>
                    <div className="tgTokenCell">
                      <TokenLogo tone={row.tone} />
                      <div className="tgTokenInfo">
                        <span className="tgTokenName">{row.name}</span>
                        <span className="tgTokenPair">{row.pair}</span>
                      </div>
                      <span className={`tgChainBadge ${row.chain}`}>
                        {row.chain === "base" ? "Base" : row.chain === "eth" ? "ETH" : row.chain === "bsc" ? "BSC" : "SOL"}
                      </span>
                    </div>
                  </td>
                  <td><span className="tgPrice">{row.price}</span></td>
                  <td><span className="tgVolume" style={{ color: "var(--text)", fontWeight: 600 }}>{row.volume24h}</span></td>
                  <td>
                    <div className="tgVolBarCell">
                      <div className="tgVolBarTrack">
                        <div className="tgVolBarFill" style={{ width: `${Math.min(row.volumePct * 5, 100)}%` }} />
                      </div>
                      <span className="tgVolBarLabel">{row.volumePct.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td><span className="tgTrades">{row.trades}</span></td>
                  <td><span className="tgLiq">{row.liquidity}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > VOLUME_PREVIEW && (
        <button className="tgViewAllBtn" type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Collapse" : `View All Volume (${rows.length})`} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick Insights — computed from real data
// ─────────────────────────────────────────────────────────────
function QuickInsights({ gainers, volumeTokens }: { gainers: TokenSummary[]; volumeTokens: TokenSummary[] }) {
  if (gainers.length === 0 && volumeTokens.length === 0) return null;

  const topGainer = gainers[0];
  const topVolume = volumeTokens[0];
  const mostActive = [...volumeTokens].sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))[0];
  const topGainerBy1h = [...gainers].sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0))[0];

  const volByChain = volumeTokens.reduce<Record<string, number>>((acc, t) => {
    acc[t.chain] = (acc[t.chain] ?? 0) + t.volume24hUsd;
    return acc;
  }, {});
  const hotChain = Object.entries(volByChain).sort((a, b) => b[1] - a[1])[0];
  const totalVol = Object.values(volByChain).reduce((s, v) => s + v, 0);

  type InsightCard = {
    label: string; logo: string; logoTone: string;
    value: string; valueTone: string; sub: string; meta: string;
    sparkPoints: string; sparkTone: string;
  };
  const cards = ([
    topGainer ? {
      label: "Biggest Gainer",
      logo: topGainer.symbol.slice(0, 2).toUpperCase(),
      logoTone: "green",
      value: `+${topGainer.priceChange24h.toFixed(2)}%`,
      valueTone: "green",
      sub: fmtPrice(topGainer.priceUsd),
      meta: topGainer.marketCapUsd > 0 ? `${fmtUsd(topGainer.marketCapUsd)} market cap` : topGainer.symbol,
      sparkPoints: "2,20 10,16 20,13 30,10 40,7 50,5 60,3 58,2",
      sparkTone: "green",
    } : null,
    topVolume ? {
      label: "Highest Volume",
      logo: topVolume.symbol.slice(0, 2).toUpperCase(),
      logoTone: "violet",
      value: fmtUsd(topVolume.volume24hUsd),
      valueTone: "violet",
      sub: fmtPrice(topVolume.priceUsd),
      meta: `${(topVolume.buys + topVolume.sells).toLocaleString()} trades`,
      sparkPoints: "2,22 10,18 20,15 30,12 40,9 50,7 60,5 58,3",
      sparkTone: "violet",
    } : null,
    mostActive ? {
      label: "Most Active",
      logo: mostActive.symbol.slice(0, 2).toUpperCase(),
      logoTone: "cyan",
      value: `${(mostActive.buys + mostActive.sells).toLocaleString()} Trades`,
      valueTone: "cyan",
      sub: fmtPrice(mostActive.priceUsd),
      meta: `${mostActive.symbol} — most swaps`,
      sparkPoints: "2,24 10,20 20,17 30,14 40,11 50,8 60,6 58,4",
      sparkTone: "cyan",
    } : null,
    topGainerBy1h && topGainerBy1h.priceChange24h > 0 ? {
      label: "Top 24H Move",
      logo: topGainerBy1h.symbol.slice(0, 2).toUpperCase(),
      logoTone: "amber",
      value: fmtPrice(topGainerBy1h.priceUsd),
      valueTone: "amber",
      sub: `+${topGainerBy1h.priceChange24h.toFixed(2)}%`,
      meta: `${topGainerBy1h.symbol} — leading move`,
      sparkPoints: "2,26 10,22 20,18 30,14 40,10 50,7 60,4 58,2",
      sparkTone: "amber",
    } : null,
    hotChain ? {
      label: "Hot Chain",
      logo: hotChain[0].slice(0, 2).toUpperCase(),
      logoTone: "blue",
      value: fmtUsd(hotChain[1]),
      valueTone: "blue",
      sub: totalVol > 0 ? `${((hotChain[1] / totalVol) * 100).toFixed(1)}% of volume` : hotChain[0].toUpperCase(),
      meta: hotChain[0] === "eth" ? "Ethereum" : hotChain[0].toUpperCase(),
      sparkPoints: "2,22 10,18 20,15 30,12 40,9 50,6 60,4 58,2",
      sparkTone: "blue",
    } : null,
  ] as (InsightCard | null)[]).filter((c): c is InsightCard => c !== null);

  if (cards.length === 0) return null;

  return (
    <section className="tgInsightsSection">
      <div className="tgInsightsSectionHead">
        <Flame size={15} />
        Quick Insights
      </div>
      <div className="tgInsightsGrid">
        {cards.map((card) => (
          <div className="tgInsightCard" key={card.label}>
            <span className="tgInsightLabel">{card.label}</span>
            <div className="tgInsightRow">
              <div className={`tgInsightTokenLogo ${card.logoTone}`}>{card.logo}</div>
              <div>
                <span className={`tgInsightValue ${card.valueTone}`}>{card.value}</span>
              </div>
            </div>
            <span className="tgInsightSub">{card.sub}</span>
            <span className="tgInsightMeta">{card.meta}</span>
            <InsightSparkline points={card.sparkPoints} tone={card.sparkTone} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// SVG Donut chart (real proportions from live data)
// ─────────────────────────────────────────────────────────────
const DONUT_CHAIN_COLORS: Record<string, string> = {
  base:  "oklch(0.65 0.2 240)",
  eth:   "oklch(0.65 0.18 290)",
  bsc:   "oklch(0.75 0.18 85)",
};
const DONUT_FALLBACK = "oklch(0.5 0.05 255)";

function DonutChart({ data }: { data: { chain: string; vol: number; pct: number }[] }) {
  const r = 30;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d) => {
    const dash = (d.pct / 100) * circumference;
    const gap  = circumference - dash;
    const seg = { ...d, dash, gap, offset };
    offset += dash;
    return seg;
  });

  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-label="Volume by chain donut chart">
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="oklch(0.22 0.04 255 / 0.4)" strokeWidth="10" />
      {segments.map((seg) => (
        <circle
          key={seg.chain}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={DONUT_CHAIN_COLORS[seg.chain] ?? DONUT_FALLBACK}
          strokeWidth="10"
          strokeDasharray={`${seg.dash} ${seg.gap}`}
          strokeDashoffset={-seg.offset + circumference / 4}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Right Panel — computed from real data
// ─────────────────────────────────────────────────────────────
function RightPanel({ gainers, volumeTokens }: { gainers: TokenSummary[]; volumeTokens: TokenSummary[] }) {
  const all = [...new Map([...gainers, ...volumeTokens].map(t => [t.address, t])).values()];
  const totalVolume = all.reduce((s, t) => s + t.volume24hUsd, 0);
  const totalMcap   = all.reduce((s, t) => s + t.marketCapUsd, 0);
  const winners     = all.filter(t => t.priceChange24h > 0).length;
  const losers      = all.filter(t => t.priceChange24h < 0).length;
  const winPct      = all.length > 0 ? Math.round((winners / all.length) * 100) : 50;
  const chainSet    = new Set(all.map(t => t.chain));

  const volByChain = all.reduce<Record<string, number>>((acc, t) => {
    acc[t.chain] = (acc[t.chain] ?? 0) + t.volume24hUsd;
    return acc;
  }, {});
  const chainVolList = Object.entries(volByChain).sort((a, b) => b[1] - a[1]);
  const donutData = chainVolList.map(([chain, vol]) => ({
    chain,
    vol,
    pct: totalVolume > 0 ? (vol / totalVolume) * 100 : 0,
  }));

  const recentlyActive = [...all]
    .sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))
    .slice(0, 5);

  return (
    <aside className="tgRightPanel">
      {/* ── Market Snapshot ──────────────────────────────────── */}
      <section>
        <div className="tgRpSectionHead">
          <span className="tgRpSectionTitle">
            <Activity size={13} />
            Market Snapshot
          </span>
        </div>
        <div className="tgStatList">
          {[
            { label: "Tokens Tracked",   value: all.length > 0 ? all.length.toLocaleString() : "—" },
            { label: "Total Volume",     value: totalVolume > 0 ? fmtUsd(totalVolume) : "—" },
            { label: "Total Market Cap", value: totalMcap > 0 ? fmtUsd(totalMcap) : "—" },
            { label: "Active Chains",    value: chainSet.size > 0 ? String(chainSet.size) : "—" },
          ].map((stat) => (
            <div className="tgStatRow" key={stat.label}>
              <span className="tgStatLabel">{stat.label}</span>
              <div className="tgStatRight">
                <span className="tgStatValue">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Volume by Chain ──────────────────────────────────── */}
      <section>
        <div className="tgRpSectionHead">
          <span className="tgRpSectionTitle">
            <CircleDollarSign size={13} />
            Volume by Chain
          </span>
        </div>
        <div className="tgDonutWrap">
          {donutData.length > 0 ? (
            <DonutChart data={donutData} />
          ) : (
            <div className="tgDonut" aria-label="No data" />
          )}
          <div className="tgDonutLegend">
            {chainVolList.map(([chain, vol]) => (
              <div className="tgDonutLegendRow" key={chain}>
                <span className={`tgDonutDot ${chain}`} />
                <span className="tgDonutLegendLabel">
                  {chain === "eth" ? "Ethereum" : chain.toUpperCase()}
                </span>
                <span className="tgDonutLegendPct">
                  {totalVolume > 0 ? `${((vol / totalVolume) * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Winners vs Losers ────────────────────────────────── */}
      <section>
        <div className="tgRpSectionHead">
          <span className="tgRpSectionTitle">
            <TrendingUp size={13} />
            Winners vs Losers
          </span>
        </div>
        <div className="tgWLLabels">
          <span className="tgWLLabelW">Winners ({winners})</span>
          <span className="tgWLLabelL">Losers ({losers})</span>
        </div>
        <div className="tgWLRow">
          <span className="tgWLWinners">{winPct}%</span>
          <span className="tgWLLosers">{100 - winPct}%</span>
        </div>
        <div className="tgWLBar">
          <div className="tgWLBarFill" style={{ width: `${winPct}%` }} />
        </div>
      </section>

      {/* ── Most Active ──────────────────────────────────────── */}
      <section>
        <div className="tgRpSectionHead">
          <span className="tgRpSectionTitle">
            <Zap size={13} />
            Most Active
          </span>
        </div>
        <div className="tgRecentList">
          {recentlyActive.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>No data yet</div>
          ) : recentlyActive.map((t) => {
            const chg = t.priceChange24h;
            return (
              <div className="tgRecentRow" key={t.address}>
                <div className="tgRecentTokenLogo">{t.symbol.slice(0, 2).toUpperCase()}</div>
                <div className="tgRecentInfo">
                  <span className="tgRecentName">{t.symbol}</span>
                  <span className="tgRecentTime">{(t.buys + t.sells).toLocaleString()} swaps</span>
                </div>
                <span className={`tgRecentBadge ${chg >= 0 ? "" : "neg"}`}>
                  {chg >= 0 ? "+" : ""}{chg.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Customize Filter Panel
// ─────────────────────────────────────────────────────────────
function CustomizePanel({
  minVolume,
  setMinVolume,
  minMcap,
  setMinMcap,
  minChange,
  setMinChange,
  onClose,
}: {
  minVolume: number;
  setMinVolume: (v: number) => void;
  minMcap: number;
  setMinMcap: (v: number) => void;
  minChange: number;
  setMinChange: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      background: "oklch(0.14 0.04 255)",
      border: "1px solid oklch(0.28 0.06 255 / 0.5)",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 12,
      display: "flex",
      gap: 20,
      flexWrap: "wrap",
      alignItems: "flex-end",
    }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
          Min 24H Volume
        </label>
        <select
          value={minVolume}
          onChange={(e) => setMinVolume(Number(e.target.value))}
          style={{
            width: "100%", background: "oklch(0.18 0.04 255)", border: "1px solid oklch(0.3 0.05 255)",
            borderRadius: 6, color: "var(--text)", fontSize: 12, padding: "4px 8px",
          }}
        >
          <option value={0}>Any</option>
          <option value={1_000}>$1K+</option>
          <option value={10_000}>$10K+</option>
          <option value={50_000}>$50K+</option>
          <option value={100_000}>$100K+</option>
          <option value={500_000}>$500K+</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
          Min Market Cap
        </label>
        <select
          value={minMcap}
          onChange={(e) => setMinMcap(Number(e.target.value))}
          style={{
            width: "100%", background: "oklch(0.18 0.04 255)", border: "1px solid oklch(0.3 0.05 255)",
            borderRadius: 6, color: "var(--text)", fontSize: 12, padding: "4px 8px",
          }}
        >
          <option value={0}>Any</option>
          <option value={10_000}>$10K+</option>
          <option value={100_000}>$100K+</option>
          <option value={500_000}>$500K+</option>
          <option value={1_000_000}>$1M+</option>
          <option value={10_000_000}>$10M+</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
          Min % Change
        </label>
        <select
          value={minChange}
          onChange={(e) => setMinChange(Number(e.target.value))}
          style={{
            width: "100%", background: "oklch(0.18 0.04 255)", border: "1px solid oklch(0.3 0.05 255)",
            borderRadius: 6, color: "var(--text)", fontSize: 12, padding: "4px 8px",
          }}
        >
          <option value={-Infinity}>Any</option>
          <option value={0}>Positive only</option>
          <option value={5}>+5%+</option>
          <option value={10}>+10%+</option>
          <option value={20}>+20%+</option>
          <option value={50}>+50%+</option>
        </select>
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none", border: "1px solid oklch(0.3 0.05 255)", borderRadius: 6,
          color: "var(--muted)", cursor: "pointer", padding: "4px 10px", fontSize: 12,
        }}
      >
        <X size={12} /> Close
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
export function TopGainersPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("24H");
  const [activeChain, setActiveChain] = useState<Chain>("All Chains");
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [gainers, setGainers] = useState<TokenSummary[]>([]);
  const [volumeTokens, setVolumeTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  const [minVolume, setMinVolume] = useState(0);
  const [minMcap, setMinMcap] = useState(0);
  const [minChange, setMinChange] = useState(-Infinity);

  const timeframes: Timeframe[] = ["5M", "15M", "1H", "6H", "24H", "7D"];

  // Re-fetch only when chain changes — timeframe sort is client-side
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const apiKey = CHAIN_API_KEY[activeChain];
    const chainParam = apiKey ? `&chain=${apiKey}` : "";
    setLoading(true);
    Promise.all([
      fetch(`${api}/api/market/tokens?sort=gainers${chainParam}`).then(r => r.json()).then(d => setGainers(d.data ?? [])),
      fetch(`${api}/api/market/tokens?sort=volume${chainParam}`).then(r => r.json()).then(d => setVolumeTokens(d.data ?? [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [activeChain]);

  // Client-side sort gainers by selected timeframe
  const sortedGainers = useMemo(() => {
    return [...gainers].sort((a, b) => getPctChange(b, timeframe) - getPctChange(a, timeframe));
  }, [gainers, timeframe]);

  // Apply customize filters
  const filteredGainers = useMemo(() => {
    return sortedGainers.filter(t =>
      t.volume24hUsd >= minVolume &&
      t.marketCapUsd >= (minMcap === 0 ? 0 : minMcap) &&
      getPctChange(t, timeframe) >= (minChange === -Infinity ? -Infinity : minChange)
    );
  }, [sortedGainers, minVolume, minMcap, minChange, timeframe]);

  const filteredVolume = useMemo(() => {
    return volumeTokens.filter(t =>
      t.volume24hUsd >= minVolume &&
      t.marketCapUsd >= (minMcap === 0 ? 0 : minMcap)
    );
  }, [volumeTokens, minVolume, minMcap]);

  function toggleStar(key: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const totalVol = filteredVolume.reduce((s, t) => s + t.volume24hUsd, 0);
  const gainerRows = filteredGainers.map((t, i) => summaryToGainer(t, i + 1, timeframe));
  const volumeRows = filteredVolume.map((t, i) => summaryToVolume(t, i + 1, totalVol));

  return (
    <div className="appShell" style={{ minHeight: "100vh" }}>
      <TopNavbar />

      <div className="tgShell">
        {/* Left sidebar */}
        <TgSidebar />

        {/* Main content */}
        <main className="tgMain" role="main" aria-label="Top Gainers and Top Volume">

          {/* Page header */}
          <div className="tgPageHeader">
            <div className="tgPageHeaderLeft">
              <h1>Top Gainers &amp; Top Volume</h1>
              <p>Discover tokens with the biggest price moves and highest trading activity.</p>
            </div>
            <div className="tgPageHeaderRight">
              <div className="tgTimeframeGroup">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    className={`tgTfBtn ${timeframe === tf ? "tgTfActive" : ""}`}
                    type="button"
                    aria-pressed={timeframe === tf}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <button
                className={`tgCustomizeBtn ${showCustomize ? "active" : ""}`}
                type="button"
                onClick={() => setShowCustomize((v) => !v)}
              >
                <Sliders size={14} /> Customize
              </button>
            </div>
          </div>

          {/* Customize filter panel */}
          {showCustomize && (
            <CustomizePanel
              minVolume={minVolume} setMinVolume={setMinVolume}
              minMcap={minMcap} setMinMcap={setMinMcap}
              minChange={minChange} setMinChange={setMinChange}
              onClose={() => setShowCustomize(false)}
            />
          )}

          {/* Chain filter tabs */}
          <div className="tgChainTabBar" role="tablist" aria-label="Filter by chain">
            {chainTabs.map((tab) => (
              <button
                key={tab.label}
                className={`tgChainTab ${activeChain === tab.label ? "tgChainActive" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeChain === tab.label}
                onClick={() => setActiveChain(tab.label)}
              >
                {tab.dotClass && (
                  <span className={`tgChainDot ${tab.dotClass}`} aria-hidden="true" />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Two-column tables */}
          <div className="tgTablesRow">
            <TopGainersTable
              rows={gainerRows}
              starred={starred}
              onToggleStar={toggleStar}
              loading={loading}
              timeframe={timeframe}
            />
            <TopVolumeTable
              rows={volumeRows}
              starred={starred}
              onToggleStar={toggleStar}
              loading={loading}
            />
          </div>

          {/* Quick Insights */}
          <QuickInsights gainers={sortedGainers} volumeTokens={volumeTokens} />
        </main>

        {/* Right panel */}
        <RightPanel gainers={gainers} volumeTokens={volumeTokens} />
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default TopGainersPage;
