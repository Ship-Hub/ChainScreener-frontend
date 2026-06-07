"use client";

import {
  Activity,
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
  RefreshCw,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MobileBottomNav } from "./MobileBottomNav";

const DistributionPanel = dynamic(() => import("./charts/HolderPieChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 200, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12 }}>
      Loading chart…
    </div>
  ),
});

const HolderGrowthChart = dynamic(() => import("./charts/HolderAreaChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 200, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12 }}>
      Loading chart…
    </div>
  ),
});

// ─────────────────────────────────────────────────────────────
// API Types
// ─────────────────────────────────────────────────────────────
interface HolderSnapshot {
  chain: string;
  tokenAddress: string;
  holderCount: number;
  top10ConcentrationPct: number;
  capturedAt: string | null;
}

interface HolderDetail {
  chain: string;
  address: string;
  summary: {
    holderCount: number;
    top10ConcentrationPct: number;
    capturedAt: string | null;
  };
  topHolders: Array<{
    wallet: string;
    balanceRaw: string;
    lastActivityBlock: number;
  }>;
}

interface MarketToken {
  chain: string;
  address: string;
  symbol: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatBalance(raw: string, symbol: string): string {
  try {
    // Shift decimal 18 places without BigInt literals (ES2017 compat)
    const DECIMALS = 18;
    const len = raw.length;
    const n = len <= DECIMALS
      ? parseFloat("0." + raw.padStart(DECIMALS, "0"))
      : parseFloat(raw.slice(0, len - DECIMALS) + "." + raw.slice(len - DECIMALS));
    if (!isFinite(n) || n < 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${symbol}`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${symbol}`;
    return `${n.toFixed(2)} ${symbol}`;
  } catch {
    return "—";
  }
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
// Top Navbar
// ─────────────────────────────────────────────────────────────
function TopNavbar() {
  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb"><Radar size={22} /></span>
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
        <button className="topButton" type="button"><Bell size={16} /> Alerts <span>12</span></button>
        <button className="topButton" type="button"><Star size={16} /> Watchlist</button>
        <button className="walletButton" type="button">
          <span className="tokenLogo blue"><b>0x</b></span>
          0x8f3…a21c
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
            {section.title ? <span className="navSectionTitle">{section.title}</span> : null}
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
        <strong><Gem size={16} /> Go Pro</strong>
        <p>Advanced analytics, real-time alerts, and unlimited scans.</p>
        <button type="button">Upgrade Now <ArrowRight size={15} /></button>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Stats Strip
// ─────────────────────────────────────────────────────────────
function StatsStrip({
  holderCount,
  top10Pct,
  loading,
}: {
  holderCount: number;
  top10Pct: number;
  loading: boolean;
}) {
  const fmt = (n: number) => (loading ? "…" : n > 0 ? n.toLocaleString() : "—");
  const whaleEst = holderCount > 0 ? Math.max(1, Math.round(holderCount * 0.04)) : 0;
  const retailEst = Math.max(0, holderCount - whaleEst);

  const stats = [
    {
      label: "Total Holders",
      value: fmt(holderCount),
      change: top10Pct > 0 ? `Top 10 hold ${top10Pct.toFixed(1)}%` : "Loading…",
      changeType: "pos" as const,
      icon: Users,
      iconTone: "violet",
    },
    {
      label: "New Holders (Est.)",
      value: holderCount > 0 ? `+${Math.round(holderCount * 0.08).toLocaleString()}` : "—",
      change: "~8% weekly growth est.",
      changeType: "pos" as const,
      icon: TrendingUp,
      iconTone: "green",
    },
    {
      label: "Whale Wallets (Est.)",
      value: fmt(whaleEst),
      change: "Top ~4% of holders",
      changeType: "neutral" as const,
      icon: Zap,
      iconTone: "amber",
    },
    {
      label: "Retail Wallets (Est.)",
      value: fmt(retailEst),
      change: "Remaining holders",
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
            <div className={`haStatIcon ${s.iconTone}`}><Icon size={16} /></div>
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
// Rank badge
// ─────────────────────────────────────────────────────────────
function rankClass(rank: number) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "";
}

// ─────────────────────────────────────────────────────────────
// Top Holders Panel
// ─────────────────────────────────────────────────────────────
const HOLDER_PREVIEW = 10;

function TopHoldersPanel({
  topHolders,
  symbol,
  loading,
  capturedAt,
  expanded,
  setExpanded,
}: {
  topHolders: HolderDetail["topHolders"];
  symbol: string;
  loading: boolean;
  capturedAt: string | null;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}) {
  const router = useRouter();
  const displayed = expanded ? topHolders : topHolders.slice(0, HOLDER_PREVIEW);

  return (
    <div className="haPanel">
      <div className="haPanelHeader">
        <h2 className="haPanelTitle">
          <Users size={14} />
          Top Holders
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {capturedAt && (
            <span className="haSyncBadge">
              <span className="haSyncDot" />
              Updated {timeAgo(capturedAt)}
            </span>
          )}
          {topHolders.length > HOLDER_PREVIEW && (
            <button className="haPanelLink" type="button" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Collapse" : `View All (${topHolders.length})`} <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      <table className="haHolderTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Wallet</th>
            <th>Balance</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} style={{ color: "var(--faint)", textAlign: "center", padding: "16px 0" }}>Loading…</td></tr>
          ) : topHolders.length === 0 ? (
            <tr><td colSpan={4} style={{ color: "var(--faint)", textAlign: "center", padding: "16px 0" }}>
              No holder data — run the holder indexer
            </td></tr>
          ) : displayed.map((row, i) => {
            const rank = i + 1;
            const isContract = row.wallet.length > 42; // rough heuristic
            const holderType = rank <= 3 ? "Whale" : rank <= 10 ? "Large" : "Unknown";
            return (
              <tr
                key={row.wallet}
                className="haHolderRow"
                onClick={() => router.push(`/wallet/${row.wallet}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/wallet/${row.wallet}`); }}
              >
                <td><span className={`haRank ${rankClass(rank)}`}>{rank}</span></td>
                <td>
                  <a
                    className="haWalletAddr"
                    href={`/wallet/${row.wallet}`}
                    onClick={(e) => e.stopPropagation()}
                    title={row.wallet}
                  >
                    {shortenAddr(row.wallet)}
                  </a>
                </td>
                <td>
                  <span className="haBalancePrimary">{formatBalance(row.balanceRaw, symbol)}</span>
                </td>
                <td>
                  <span className={`haTypeBadge ${holderType.toLowerCase()}`}>{holderType}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Whale Movements — demo data with clear label
// ─────────────────────────────────────────────────────────────
const DEMO_MOVEMENTS = [
  { id: "m1",  action: "BUY"  as const, timeAgo: "2m ago",  wallet: "0x7c1e...8a2b", usd: "+$12,227",  tokens: "+1.24M" },
  { id: "m2",  action: "SELL" as const, timeAgo: "18m ago", wallet: "0x5e21...9d4a", usd: "-$8,912",   tokens: "-1.87M" },
  { id: "m3",  action: "BUY"  as const, timeAgo: "47m ago", wallet: "0x9a3b...7c1d", usd: "+$5,420",   tokens: "+1.12M" },
  { id: "m4",  action: "SELL" as const, timeAgo: "1h ago",  wallet: "0x1f32...aa11", usd: "-$6,231",   tokens: "-2.44M" },
  { id: "m5",  action: "BUY"  as const, timeAgo: "2h ago",  wallet: "0x2d4f...e9a1", usd: "+$3,100",   tokens: "+680K"  },
];

function WhaleMovementsPanel() {
  const router = useRouter();
  return (
    <div className="haPanel">
      <div className="haPanelHeader">
        <h2 className="haPanelTitle"><Zap size={14} /> Whale Movements (24H)</h2>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 20,
          background: "oklch(0.22 0.06 85 / 0.4)", color: "oklch(0.8 0.15 85)",
          border: "1px solid oklch(0.4 0.1 85 / 0.4)",
        }}>
          Demo
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 8, padding: "0 2px" }}>
        Live whale tracking requires transaction indexing per wallet.
      </div>

      <div className="haMovements">
        {DEMO_MOVEMENTS.map((mv) => {
          const isBuy = mv.action === "BUY";
          return (
            <div
              key={mv.id}
              className={`haMovement ${isBuy ? "haMovementBuy" : "haMovementSell"}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/wallet/${mv.wallet}`)}
              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/wallet/${mv.wallet}`); }}
            >
              <span className={`haMovementBadge ${isBuy ? "buy" : "sell"}`}>{mv.action}</span>
              <span className="haMovementTime">{mv.timeAgo}</span>
              <a className="haMovementWallet" href={`/wallet/${mv.wallet}`} onClick={(e) => e.stopPropagation()}>
                {mv.wallet}
              </a>
              <div className="haMovementAmounts">
                <span className={`haMovementUsd ${isBuy ? "pos" : "neg"}`}>{mv.usd}</span>
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
// Token Selector Dropdown
// ─────────────────────────────────────────────────────────────
function TokenSelector({
  snapshots,
  selected,
  tokenMeta,
  onSelect,
  loading,
}: {
  snapshots: HolderSnapshot[];
  selected: HolderSnapshot | null;
  tokenMeta: Map<string, MarketToken>;
  onSelect: (s: HolderSnapshot) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const label = (() => {
    if (!selected) return loading ? "Loading…" : "Select token";
    const meta = tokenMeta.get(`${selected.chain}:${selected.tokenAddress}`);
    return meta?.symbol ?? shortenAddr(selected.tokenAddress);
  })();

  return (
    <div style={{ position: "relative" }}>
      <button
        className="haTokenSelector"
        type="button"
        aria-label="Select token"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={snapshots.length === 0}
      >
        <span className="haTokenDot" />
        {label}
        <ChevronDown size={15} />
      </button>

      {open && snapshots.length > 0 && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 200,
            background: "oklch(0.14 0.04 255)", border: "1px solid oklch(0.28 0.06 255 / 0.5)",
            borderRadius: 10, minWidth: 220, maxHeight: 280, overflowY: "auto",
            boxShadow: "0 8px 32px oklch(0 0 0 / 0.5)",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {snapshots.map((snap) => {
            const meta = tokenMeta.get(`${snap.chain}:${snap.tokenAddress}`);
            const sym = meta?.symbol ?? shortenAddr(snap.tokenAddress);
            const isActive = selected?.tokenAddress === snap.tokenAddress && selected?.chain === snap.chain;
            return (
              <button
                key={`${snap.chain}:${snap.tokenAddress}`}
                type="button"
                onClick={() => { onSelect(snap); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "8px 14px",
                  background: isActive ? "oklch(0.2 0.05 255 / 0.5)" : "none",
                  border: "none", cursor: "pointer", textAlign: "left",
                  color: "var(--text)", fontSize: 13,
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "oklch(0.2 0.07 255)", display: "grid", placeItems: "center",
                  fontSize: 9, fontWeight: 800, color: "var(--cyan)", flexShrink: 0,
                }}>
                  {sym.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{sym}</div>
                  <div style={{ fontSize: 10, color: "var(--faint)" }}>
                    {snap.chain.toUpperCase()} · {snap.holderCount.toLocaleString()} holders
                  </div>
                </div>
                {isActive && <span style={{ marginLeft: "auto", color: "var(--cyan)" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────
export function HolderAnalysisPage() {
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const [snapshots, setSnapshots] = useState<HolderSnapshot[]>([]);
  const [selectedSnap, setSelectedSnap] = useState<HolderSnapshot | null>(null);
  const [detail, setDetail] = useState<HolderDetail | null>(null);
  const [tokenMeta, setTokenMeta] = useState<Map<string, MarketToken>>(new Map());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandHolders, setExpandHolders] = useState(false);

  // Initial load: all snapshots + market token metadata for symbols
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/holders`).then((r) => r.json()),
      fetch(`${API}/api/market/tokens?sort=volume`).then((r) => r.json()),
    ])
      .then(([holdersData, marketData]) => {
        const snaps: HolderSnapshot[] = holdersData.data ?? [];
        setSnapshots(snaps);

        const meta = new Map<string, MarketToken>();
        for (const t of marketData.data ?? []) {
          meta.set(`${t.chain}:${t.address}`, t);
        }
        setTokenMeta(meta);

        if (snaps.length > 0) setSelectedSnap(snaps[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  // Fetch detail whenever selected token changes
  useEffect(() => {
    if (!selectedSnap) return;
    setDetailLoading(true);
    setExpandHolders(false);
    fetch(`${API}/api/holders/${selectedSnap.chain}/${selectedSnap.tokenAddress}`)
      .then((r) => r.json())
      .then((d) => setDetail(d.data ?? null))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedSnap, API]);

  const meta = selectedSnap ? tokenMeta.get(`${selectedSnap.chain}:${selectedSnap.tokenAddress}`) : null;
  const symbol = meta?.symbol ?? selectedSnap?.tokenAddress?.slice(0, 6).toUpperCase() ?? "TOKEN";

  const holderCount = detail?.summary?.holderCount ?? selectedSnap?.holderCount ?? 0;
  const top10Pct = detail?.summary?.top10ConcentrationPct ?? selectedSnap?.top10ConcentrationPct ?? 0;
  const capturedAt = detail?.summary?.capturedAt ?? selectedSnap?.capturedAt ?? null;
  const topHolders = detail?.topHolders ?? [];

  const noData = !loading && snapshots.length === 0;

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
              <p className="haSubtitle">Track whale wallets, holder distribution, and growth trends</p>
            </div>

            <TokenSelector
              snapshots={snapshots}
              selected={selectedSnap}
              tokenMeta={tokenMeta}
              onSelect={setSelectedSnap}
              loading={loading}
            />
          </div>

          {/* Info banner */}
          {noData ? (
            <div className="haBanner" role="alert">
              <Info size={15} />
              <span className="haBannerText">
                <strong>No holder snapshots found.</strong> Run the holder indexer to populate data.
              </span>
            </div>
          ) : !loading && top10Pct === 0 && holderCount === 0 ? (
            <div className="haBanner" role="alert">
              <Info size={15} />
              <span className="haBannerText">
                <strong>Holder data requires on-chain indexing.</strong> Connect a full-node RPC to enable live holder tracking.
                {capturedAt && ` Last snapshot: ${timeAgo(capturedAt)}.`}
              </span>
            </div>
          ) : null}

          {/* Stats strip */}
          <StatsStrip holderCount={holderCount} top10Pct={top10Pct} loading={loading || detailLoading} />

          {/* 3-column grid */}
          <div className="haGrid">
            <div className="haPanel">
              <div className="haPanelHeader">
                <h2 className="haPanelTitle">
                  <PieChartIcon size={14} />
                  Holder Distribution
                </h2>
              </div>
              <DistributionPanel top10Pct={top10Pct > 0 ? top10Pct : undefined} />
            </div>

            <TopHoldersPanel
              topHolders={topHolders}
              symbol={symbol}
              loading={detailLoading}
              capturedAt={capturedAt}
              expanded={expandHolders}
              setExpanded={setExpandHolders}
            />

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
