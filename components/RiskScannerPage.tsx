"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Eye,
  Gem,
  Info,
  KeyRound,
  Layers,
  Lock,
  Radar,
  RefreshCw,
  Scan,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchTopTokens } from "../lib/api";
import type { TokenSummary } from "../lib/types";
import { MobileBottomNav } from "./MobileBottomNav";

// ─────────────────────────────────────────────────────────────
// Risk factor computation
// ─────────────────────────────────────────────────────────────
type Severity = "safe" | "info" | "warning" | "critical";

type RiskFactor = {
  severity: Severity;
  label: string;
  desc: string;
};

function computeRiskFactors(token: TokenSummary): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const ageHours = token.ageMinutes / 60;
  const buyRatio = token.buys / Math.max(1, token.buys + token.sells);
  const swaps24h = token.buys + token.sells;

  if (ageHours < 1) {
    factors.push({ severity: "critical", label: "< 1h old", desc: "Extremely new — no track record" });
  } else if (ageHours < 24) {
    factors.push({ severity: "warning", label: "< 24h old", desc: "New token, limited history" });
  }

  if (token.volume24hUsd < 1_000) {
    factors.push({ severity: "critical", label: "Very low volume", desc: "Under $1K daily volume" });
  } else if (token.volume24hUsd < 10_000) {
    factors.push({ severity: "warning", label: "Low volume", desc: "Under $10K daily volume" });
  } else if (token.volume24hUsd > 100_000) {
    factors.push({ severity: "safe", label: "Strong volume", desc: "Over $100K daily volume" });
  }

  if (buyRatio > 0.92) {
    factors.push({ severity: "warning", label: "Buy-skewed", desc: `${Math.round(buyRatio * 100)}% buys — possible pump` });
  }
  if (buyRatio < 0.15) {
    factors.push({ severity: "critical", label: "Sell pressure", desc: `${Math.round((1 - buyRatio) * 100)}% sells — possible dump` });
  }

  if (swaps24h < 5) {
    factors.push({ severity: "critical", label: "Inactive", desc: "Fewer than 5 swaps in 24h" });
  } else if (swaps24h < 20) {
    factors.push({ severity: "warning", label: "Low activity", desc: "Fewer than 20 swaps in 24h" });
  }

  if (token.smartWalletBuys >= 5) {
    factors.push({ severity: "safe", label: "Smart money", desc: `${token.smartWalletBuys} smart wallets entered` });
  }

  if (token.lifecycle === "hot") {
    factors.push({ severity: "info", label: "Trending", desc: "Currently hot on the radar" });
  }

  if (token.riskLevel === "Low") {
    factors.push({ severity: "safe", label: "Low risk score", desc: `Score ${token.riskScore}/100` });
  }
  if (token.riskLevel === "High" || token.riskLevel === "Extreme") {
    factors.push({ severity: "critical", label: "High risk score", desc: `Score ${token.riskScore}/100` });
  }

  return factors;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatAge(ageMinutes: number): string {
  if (ageMinutes < 60) return `${Math.round(ageMinutes)}m`;
  const h = Math.floor(ageMinutes / 60);
  const m = Math.round(ageMinutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function formatPrice(val: number): string {
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  return `$${val.toExponential(2)}`;
}

function scoreColorClass(score: number): string {
  if (score <= 30) return "score-safe";
  if (score <= 60) return "score-medium";
  if (score <= 80) return "score-high";
  return "score-extreme";
}

function tokenTone(symbol: string): string {
  const tones = ["cyan", "green", "amber", "violet", "red"];
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) & 0xffff;
  return tones[h % tones.length];
}

// ─────────────────────────────────────────────────────────────
// Inline SVG donut — small (table cell)
// ─────────────────────────────────────────────────────────────
function ScoreDonut({ score }: { score: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const cls = scoreColorClass(score);
  return (
    <div className="rsRiskScore">
      <div className="rsDonutWrap">
        <svg className="rsDonutSvg" viewBox="0 0 36 36">
          <circle className="rsDonutBg" cx="18" cy="18" r={r} />
          <circle
            className={`rsDonutFill ${cls}`}
            cx="18"
            cy="18"
            r={r}
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset="0"
          />
        </svg>
        <div className="rsDonutLabel">{score}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline SVG donut — large (detail panel)
// ─────────────────────────────────────────────────────────────
function GaugeDonut({ score }: { score: number }) {
  const r = 37;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const cls = scoreColorClass(score);
  return (
    <div className="rsGaugeSvgWrap">
      <svg className="rsGaugeSvg" viewBox="0 0 90 90">
        <circle className="rsGaugeBg" cx="45" cy="45" r={r} />
        <circle
          className={`rsGaugeFill ${cls}`}
          cx="45"
          cy="45"
          r={r}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset="0"
        />
      </svg>
      <div className="rsGaugeCenter">
        <span className="rsGaugeNum">{score}</span>
        <span className="rsGaugeDenom">/100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Factor severity icon
// ─────────────────────────────────────────────────────────────
function FactorIcon({ severity }: { severity: Severity }) {
  switch (severity) {
    case "safe":     return <CheckCircle size={13} />;
    case "info":     return <Info size={13} />;
    case "warning":  return <AlertTriangle size={13} />;
    case "critical": return <XCircle size={13} />;
  }
}

// ─────────────────────────────────────────────────────────────
// Navigation config (same as other pages)
// ─────────────────────────────────────────────────────────────
const navSections = [
  {
    title: "",
    items: [
      { label: "Radar",         icon: Radar,            route: "/" },
      { label: "Launches",      icon: Activity,         route: "/launches" },
      { label: "Watchlist",     icon: Star,             route: "/watchlist" },
      { label: "Alerts",        icon: Bell,             route: "/alerts" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money",    icon: Zap,       route: "/smart-money" },
      { label: "Wallet Explorer",icon: Wallet,    route: "/wallet-explorer" },
      { label: "Holder Analysis",icon: Crosshair, route: "/holder-analysis" },
      { label: "Risk Scanner",   icon: Shield,    route: "/risk-scanner", active: true },
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
// Top Navbar
// ─────────────────────────────────────────────────────────────
function TopNavbar() {
  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb"><Radar size={22} /></span>
        <div>
          <strong>Chain Screener</strong>
          <span>Risk Scanner</span>
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
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "oklch(0.17 0.04 210)", display: "inline-grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "var(--cyan)" }}>0x</span>
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
function RsSidebar() {
  const router = useRouter();
  return (
    <aside className="rsSidebar">
      <nav aria-label="Risk Scanner navigation">
        {navSections.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? <span className="navSectionTitle">{section.title}</span> : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = Boolean((item as { active?: boolean }).active);
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
        <p>Advanced risk analytics, real-time alerts, and unlimited token scans.</p>
        <button type="button">Upgrade Now <ArrowRight size={15} /></button>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton loading
// ─────────────────────────────────────────────────────────────
function SkeletonTable() {
  return (
    <div className="rsTableWrap">
      <div className="rsSkeleton">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="rsSkeletonRow" key={i}>
            <div className="rsSkeletonBlock" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
              <div className="rsSkeletonBlock" style={{ width: `${55 + (i % 3) * 15}px` }} />
              <div className="rsSkeletonBlock" style={{ width: `${35 + (i % 4) * 10}px`, opacity: 0.5 }} />
            </div>
            <div className="rsSkeletonBlock" style={{ width: 48 }} />
            <div className="rsSkeletonBlock" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
            <div className="rsSkeletonBlock" style={{ width: 120 }} />
            <div className="rsSkeletonBlock" style={{ width: 64 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail panel
// ─────────────────────────────────────────────────────────────
function DetailPanel({
  token,
  watchlist,
  onToggleWatchlist,
}: {
  token: TokenSummary | null;
  watchlist: Set<string>;
  onToggleWatchlist: (t: TokenSummary) => void;
}) {
  const router = useRouter();

  if (!token) {
    return (
      <div className="rsRightPanel">
        <div className="rsDetailEmpty">
          <div className="rsDetailEmptyIcon"><Shield size={24} /></div>
          <p className="rsDetailEmptyText">Select a token to view risk analysis</p>
        </div>
      </div>
    );
  }

  const factors = computeRiskFactors(token);
  const tone = tokenTone(token.symbol);
  const priceChangePos = token.priceChange24h >= 0;
  const lvl = token.riskLevel.toLowerCase() as "low" | "medium" | "high" | "extreme";
  const wKey = `${token.chain}:${token.address}`;
  const inWatchlist = watchlist.has(wKey);

  return (
    <div className="rsRightPanel">
      <div className="rsDetailPanel">
        <div className="rsDetailHeader">
          <div className={`rsDetailTokenLogo tone-${tone}`}>{token.symbol.slice(0, 2).toUpperCase()}</div>
          <div className="rsDetailTokenInfo">
            <span className="rsDetailSymbol">{token.symbol}</span>
            <span className="rsDetailName">{token.name}</span>
          </div>
          <div className="rsDetailPrice">
            <span className="rsDetailPriceVal">{formatPrice(token.priceUsd)}</span>
            <span className={`rsDetailChange ${priceChangePos ? "pos" : "neg"}`}>
              {priceChangePos ? "+" : ""}{token.priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="rsDetailGauge">
          <span className="rsDetailGaugeLabel">Risk Score</span>
          <GaugeDonut score={token.riskScore} />
          <div className="rsDetailBadgeRow">
            <span className={`rsRiskLevelBadge ${lvl}`}>{token.riskLevel} Risk</span>
            <span className="chainBadge" style={{ textTransform: "uppercase", fontSize: 10 }}>{token.chain}</span>
          </div>
        </div>

        <div>
          <p className="rsSectionTitle">Risk Factors Breakdown</p>
          {factors.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 12 }}>No notable risk factors detected.</p>
          ) : (
            <div className="rsFactorList">
              {factors.map((f, i) => (
                <div key={i} className={`rsFactorRow ${f.severity}`}>
                  <div className="rsFactorIcon"><FactorIcon severity={f.severity} /></div>
                  <div className="rsFactorText">
                    <span className="rsFactorLabel">{f.label}</span>
                    <span className="rsFactorDesc">{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="rsSectionTitle">Quick Actions</p>
          <div className="rsQuickActions">
            <button
              className="rsActionBtn primary"
              type="button"
              onClick={() => router.push(`/token/${token.chain}/${token.address}`)}
            >
              <Eye size={14} /> View Full Token Analysis
            </button>
            <button
              className={`rsActionBtn secondary ${inWatchlist ? "active" : ""}`}
              type="button"
              onClick={() => onToggleWatchlist(token)}
            >
              <Star size={14} fill={inWatchlist ? "currentColor" : "none"} />
              {inWatchlist ? "In Watchlist ✓" : "Add to Watchlist"}
            </button>
            <button className="rsActionBtn disabled" type="button" disabled>
              <Bell size={14} /> Set Alert (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter type
// ─────────────────────────────────────────────────────────────
type FilterTab = "All" | "Low Risk" | "Medium" | "High Risk" | "Very High";

function applyFilter(tokens: TokenSummary[], filter: FilterTab): TokenSummary[] {
  switch (filter) {
    case "Low Risk":  return tokens.filter((t) => t.riskLevel === "Low");
    case "Medium":    return tokens.filter((t) => t.riskLevel === "Medium");
    case "High Risk": return tokens.filter((t) => t.riskLevel === "High");
    case "Very High": return tokens.filter((t) => t.riskLevel === "Extreme");
    default:          return tokens;
  }
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function RiskScannerPage() {
  const router = useRouter();

  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenSummary | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [scanTime, setScanTime] = useState("just now");
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { setWatchlist(new Set<string>(JSON.parse(localStorage.getItem("cs:watchlist") ?? "[]"))); }
    catch {}
  }, []);

  const toggleWatchlist = (token: TokenSummary) => {
    const key = `${token.chain}:${token.address}`;
    setWatchlist(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem("cs:watchlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchTopTokens("volume");
      if (!data || data.length === 0) {
        // try gainers as fallback
        const data2 = await fetchTopTokens("gainers");
        setTokens(data2);
      } else {
        setTokens(data);
      }
      setScanTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Compute overview stats
  const safeCount   = tokens.filter((t) => t.riskLevel === "Low").length;
  const monitorCount = tokens.filter((t) => t.riskLevel === "Medium").length;
  const highCount   = tokens.filter((t) => t.riskLevel === "High" || t.riskLevel === "Extreme").length;
  const totalCount  = tokens.length;

  // Filter + sort (most risky first)
  const displayTokens = applyFilter(tokens, activeFilter)
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore);

  const filterTabs: FilterTab[] = ["All", "Low Risk", "Medium", "High Risk", "Very High"];

  return (
    <div className="appShell" style={{ minHeight: "100vh" }}>
      <TopNavbar />

      <div className="rsShell">
        <RsSidebar />

        <main className="rsMain" role="main" aria-label="Risk Scanner">
          <div className="rsContent">

            {/* Page header */}
            <div className="rsHeader">
              <div className="rsHeaderLeft">
                <h1 className="rsHeaderTitle">Risk Scanner</h1>
                <p className="rsSubtitle">Real-time risk analysis across all tracked tokens</p>
              </div>
              <button className="rsLastScan" type="button" onClick={() => void load()}>
                <RefreshCw size={13} />
                Last scan: {scanTime}
              </button>
            </div>

            {/* Stat cards */}
            <div className="rsStatCards">
              <div className="rsStatCard green">
                <div className="rsStatIcon green">
                  <Shield size={18} />
                </div>
                <div className="rsStatBody">
                  <span className="rsStatVal">{safeCount}</span>
                  <span className="rsStatLabel">Safe Tokens</span>
                </div>
              </div>
              <div className="rsStatCard amber">
                <div className="rsStatIcon amber">
                  <AlertTriangle size={18} />
                </div>
                <div className="rsStatBody">
                  <span className="rsStatVal">{monitorCount}</span>
                  <span className="rsStatLabel">Monitor</span>
                </div>
              </div>
              <div className="rsStatCard red">
                <div className="rsStatIcon red">
                  <XCircle size={18} />
                </div>
                <div className="rsStatBody">
                  <span className="rsStatVal">{highCount}</span>
                  <span className="rsStatLabel">High Risk</span>
                </div>
              </div>
              <div className="rsStatCard cyan">
                <div className="rsStatIcon cyan">
                  <Scan size={18} />
                </div>
                <div className="rsStatBody">
                  <span className="rsStatVal">{totalCount}</span>
                  <span className="rsStatLabel">Total Scanned</span>
                </div>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="rsFilterTabs" role="tablist" aria-label="Risk filter">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  className={`rsFilterTab ${activeFilter === tab ? "active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab}
                  onClick={() => setActiveFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Table / states */}
            {loading ? (
              <SkeletonTable />
            ) : error ? (
              <div className="rsError">
                <XCircle size={32} className="rsErrorIcon" />
                <h3 className="rsErrorTitle">Failed to load token data</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                  Could not reach the API. Please check your connection.
                </p>
                <button className="rsRetryBtn" type="button" onClick={() => void load()}>
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
            ) : displayTokens.length === 0 ? (
              <div className="rsEmpty">
                <Shield size={32} />
                <p style={{ margin: 0, fontSize: 13 }}>No tokens match this filter</p>
              </div>
            ) : (
              <div className="rsTableWrap" role="region" aria-label="Token risk table">
                <table className="rsTable" aria-label="Risk scanner results">
                  <thead>
                    <tr>
                      <th className="rsTh" style={{ width: "22%" }}>Token</th>
                      <th className="rsTh" style={{ width: "8%" }}>Chain</th>
                      <th className="rsTh" style={{ width: "8%" }}>Age</th>
                      <th className="rsTh" style={{ width: "12%" }}>Risk Score</th>
                      <th className="rsTh" style={{ width: "26%" }}>Risk Factors</th>
                      <th className="rsTh" style={{ width: "10%" }}>Volume (24H)</th>
                      <th className="rsTh" style={{ width: "8%" }}>Swaps</th>
                      <th className="rsTh" style={{ width: "6%" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTokens.map((token) => {
                      const factors = computeRiskFactors(token);
                      const visible = factors.slice(0, 3);
                      const overflow = factors.length - visible.length;
                      const tone = tokenTone(token.symbol);
                      const isSelected = selectedToken?.address === token.address && selectedToken?.chain === token.chain;
                      const swaps24h = token.buys + token.sells;

                      return (
                        <tr
                          key={`${token.chain}-${token.address}`}
                          className={`rsTr ${isSelected ? "selected" : ""}`}
                          onClick={() => setSelectedToken(isSelected ? null : token)}
                          aria-selected={isSelected}
                        >
                          {/* TOKEN */}
                          <td className="rsTd">
                            <div className="rsTokenCell">
                              <div className={`rsTokenLogo tone-${tone}`} aria-hidden="true">
                                {token.symbol.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <span className="rsTokenName">{token.symbol}</span>
                                <span className="rsTokenSub">{token.name}</span>
                              </div>
                            </div>
                          </td>

                          {/* CHAIN */}
                          <td className="rsTd">
                            <span className={`rsChainBadge ${token.chain}`}>
                              {token.chain}
                            </span>
                          </td>

                          {/* AGE */}
                          <td className="rsTd">
                            <span className="rsAgeText">{formatAge(token.ageMinutes)}</span>
                          </td>

                          {/* RISK SCORE */}
                          <td className="rsTd">
                            <ScoreDonut score={token.riskScore} />
                          </td>

                          {/* RISK FACTORS */}
                          <td className="rsTd">
                            <div className="rsFactorChips">
                              {visible.map((f, i) => (
                                <span key={i} className={`rsFactorChip ${f.severity}`} title={f.desc}>
                                  {f.label}
                                </span>
                              ))}
                              {overflow > 0 && (
                                <span className="rsMoreChip">+{overflow}</span>
                              )}
                            </div>
                          </td>

                          {/* VOLUME */}
                          <td className="rsTd">
                            <span className="rsVolText">{formatUsd(token.volume24hUsd)}</span>
                          </td>

                          {/* SWAPS */}
                          <td className="rsTd">
                            <span className="rsSwapsText">{swaps24h.toLocaleString()}</span>
                          </td>

                          {/* ACTIONS */}
                          <td className="rsTd">
                            <button
                              className="rsActionIcon"
                              type="button"
                              title="View token analysis"
                              aria-label={`View ${token.symbol} analysis`}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/token/${token.chain}/${token.address}`);
                              }}
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Right detail panel */}
        <DetailPanel token={selectedToken} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} />
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default RiskScannerPage;
