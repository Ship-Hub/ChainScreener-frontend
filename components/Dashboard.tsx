"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  Crosshair,
  Database,
  Droplets,
  Expand,
  ExternalLink,
  Eye,
  Filter,
  Gauge,
  Gem,
  Hexagon,
  KeyRound,
  Layers,
  Lock,
  Pause,
  Play,
  Radar,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { dispatchNavStart } from "./NavigationProgress";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ChainKey, LivePool, LiveSwap, RiskLevel, TokenSummary } from "../lib/types";
import { fetchLiveData, subscribeLiveFeed } from "../lib/api";
import { MobileBottomNav } from "./MobileBottomNav";

type DashboardProps = {
  initialTokens: TokenSummary[];
  initialTrending: TokenSummary[];
  initialLivePools: LivePool[];
  initialLiveSwaps: LiveSwap[];
  alertCount: number;
};

type RadarType = "healthy" | "watch" | "high-risk" | "smart-money" | "viral";

type RadarToken = TokenSummary & {
  id: string;
  ticker: string;
  age: string;
  buyers: number;
  sellers: number;
  holderGrowth: number;
  liquidityLocked: number;
  radarX: number;
  radarY: number;
  radarSize: number;
  radarType: RadarType;
  signalStrength: number;
};


type RightPanel = "stats" | "watchlist" | "coming-soon";

const chainOptions: Array<"all" | ChainKey> = ["all", "base", "eth", "bsc"];

const navSections = [
  {
    title: "",
    items: [
      { label: "Radar", icon: Radar },
      { label: "Launches", icon: Activity },
      { label: "Watchlist", icon: Star },
      { label: "Opportunities", icon: Gem },
      { label: "Alerts", icon: Bell },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Smart Money", icon: Zap },
      { label: "Wallet Explorer", icon: Wallet },
      { label: "Holder Analysis", icon: Crosshair },
      { label: "Risk Scanner", icon: Shield },
      { label: "Top Gainers", icon: TrendingUp },
      { label: "Top Volume", icon: CircleDollarSign },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "DEX Pools", icon: Layers },
      { label: "Liquidity Locks", icon: Lock },
      { label: "Contract Analyzer", icon: Database },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Settings", icon: Settings },
      { label: "API Access", icon: KeyRound },
      { label: "Documentation", icon: BookOpen },
    ],
  },
];

// Leaderboard entry shape returned by /api/smart-money/leaderboard
type LeaderEntry = {
  rank: number;
  wallet: string;
  score: number;
  totalTrades: number;
  winRatePct: number;
  realizedPnlUsd: number;
  earlyEntryPct: number;
  totalClosedTrades: number;
  lastSeenAt: string | null;
};

const logoPalette = ["cyan", "amber", "violet", "green", "rose", "blue"];

const COMING_SOON = new Set([
  "DEX Pools", "Liquidity Locks", "Contract Analyzer", "Opportunities", "Alerts", "Wallet Explorer",
]);

export function Dashboard({ initialTokens, initialTrending, initialLivePools, initialLiveSwaps, alertCount }: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tokens, setTokens] = useState(initialTokens);
  const [livePools, setLivePools] = useState(initialLivePools);
  const [liveSwaps, setLiveSwaps] = useState(initialLiveSwaps);
  const [chain, setChain] = useState<"all" | ChainKey>("all");
  const [live, setLive] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 5>(1);
  const [filterRisks, setFilterRisks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [rightPanel, setRightPanel] = useState<RightPanel>("stats");
  const [activeNav, setActiveNav] = useState("Radar");
  const [comingSoonLabel, setComingSoonLabel] = useState("");
  // Tracks which sidebar item is mid-navigation so we can show a pending state
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  // Clear the sidebar loading indicator once the new route has mounted
  useEffect(() => { setPendingNav(null); }, [pathname]);

  useEffect(() => {
    if (!live) return;

    let active = true;
    let streamHealthy = false;

    const applyLiveData = ({
      tokens: nextTokens,
      livePools: nextPools,
      liveSwaps: nextSwaps,
    }: {
      tokens: TokenSummary[];
      livePools: LivePool[];
      liveSwaps: LiveSwap[];
    }) => {
      if (!active) return;
      if (nextTokens.length) setTokens(nextTokens);
      if (nextPools.length) setLivePools(nextPools);
      if (nextSwaps.length) setLiveSwaps(nextSwaps);
    };

    const unsubscribe = subscribeLiveFeed(
      (snapshot) => {
        streamHealthy = true;
        applyLiveData(snapshot);
      },
      () => {
        streamHealthy = false;
      },
    );

    const poll = () => {
      if (streamHealthy) return;
      fetchLiveData().then(({ tokens: t, livePools: p, liveSwaps: s }) => {
        applyLiveData({ tokens: t, livePools: p, liveSwaps: s });
      });
    };

    poll();
    const     id = setInterval(poll, Math.round(30_000 / speed));
    return () => {
      active = false;
      clearInterval(id);
      unsubscribe();
    };
  }, [live, speed]);

  const radarTokens = useMemo(() => enrichTokens(tokens), [tokens]);
  const trendingTokens = useMemo(() => enrichTokens(tokens.length ? tokens : initialTrending), [tokens, initialTrending]);

  const openTokenPage = useCallback((token: RadarToken) => {
    dispatchNavStart();
    router.push(`/token/${token.chain}/${token.address}`);
  }, [router]);

  // All token interactions navigate directly to the dedicated token page
  const showTokenInPanel = openTokenPage;

  const openWatchlist = useCallback(() => {
    setRightPanel("watchlist");
    setActiveNav("Watchlist");
  }, []);

  const handleNavClick = useCallback((label: string) => {
    if (pendingNav) return; // Ignore clicks while a navigation is already in-flight

    const go = (href: string) => {
      setPendingNav(label);
      dispatchNavStart();
      router.push(href);
    };

    if (label === "Launches")       { go("/launches");                return; }
    if (label === "Smart Money")    { go("/smart-money");             return; }
    if (label === "Top Gainers")    { go("/top-gainers");             return; }
    if (label === "Top Volume")     { go("/top-gainers?sort=volume"); return; }
    if (label === "Risk Scanner")   { go("/risk-scanner");            return; }
    if (label === "Holder Analysis"){ go("/holder-analysis");         return; }
    if (COMING_SOON.has(label)) {
      setComingSoonLabel(label);
      setRightPanel("coming-soon");
      setActiveNav(label);
      return;
    }
    if (label === "Watchlist") { openWatchlist(); return; }
    if (label === "Radar")     { setRightPanel("stats"); }
    setActiveNav(label);
  }, [router, openWatchlist, pendingNav]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTokens = useMemo(() => {
    let list = radarTokens.filter(t => chain === "all" || t.chain === chain);
    if (filterRisks.size > 0) list = list.filter(t => filterRisks.has(t.riskLevel));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.ticker.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
      );
    }
    return list;
  }, [radarTokens, chain, filterRisks, searchQuery]);

  const topToken = visibleTokens[0];

  return (
    <AppShell>
      <TopNavbar
        alertCount={alertCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchTokens={radarTokens}
        onSearchSelect={showTokenInPanel}
        onWatchlistClick={openWatchlist}
      />
      <TrendingTicker tokens={trendingTokens} onSelect={showTokenInPanel} />
      <div className="dashboardGrid">
        <Sidebar activeItem={activeNav} pendingItem={pendingNav} onNavigate={handleNavClick} />
        <main className="radarWorkspace">
          <LaunchRadar
            tokens={visibleTokens}
            selected={topToken}
            chain={chain}
            live={live}
            speed={speed}
            filterRisks={filterRisks}
            onChainChange={setChain}
            onLiveChange={setLive}
            onSpeedChange={setSpeed}
            onFilterChange={setFilterRisks}
            onSelect={showTokenInPanel}
          />
          <section className="lowerGrid" aria-label="Launch intelligence">
            <LatestLaunchesCard tokens={visibleTokens} onSelect={showTokenInPanel} />
            <HighConvictionCard tokens={visibleTokens} onSelect={showTokenInPanel} />
          </section>
        </main>
        {rightPanel === "watchlist"
          ? <WatchlistPanel onClose={() => { setRightPanel("stats"); setActiveNav("Radar"); }} />
          : rightPanel === "coming-soon"
          ? <ComingSoonPanel label={comingSoonLabel} onClose={() => { setRightPanel("stats"); setActiveNav("Radar"); }} />
          : <MarketStatsPanel tokens={visibleTokens} liveSwaps={liveSwaps} onTokenClick={openTokenPage} />
        }
      </div>
    </AppShell>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="appShell">
      {children}
      <MobileBottomNav />
    </div>
  );
}

function TopNavbar({
  alertCount,
  searchQuery,
  onSearchChange,
  searchTokens,
  onSearchSelect,
  onWatchlistClick,
}: {
  alertCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchTokens: RadarToken[];
  onSearchSelect: (t: RadarToken) => void;
  onWatchlistClick: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return searchTokens
      .filter(t => t.ticker.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, searchTokens]);

  return (
    <header className="topNavbar">
      <div className="brandLockup">
        <span className="brandOrb"><Radar size={22} /></span>
        <div>
          <strong>Chain Screener</strong>
          <span>Launch radar</span>
        </div>
      </div>

      {/* Search */}
      <div className="commandSearchWrap">
        <label className="commandSearch">
          <Search size={18} />
          <input
            ref={searchRef}
            placeholder="Search token, wallet, contract, or address..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          />
          <kbd>⌘ K</kbd>
        </label>
        {searchFocused && searchResults.length > 0 && (
          <div className="searchDropdown">
            {searchResults.map(t => (
              <button
                key={t.address}
                type="button"
                className="searchResult"
                onMouseDown={() => { onSearchSelect(t); onSearchChange(""); }}
              >
                <TokenLogo label={t.ticker} tone="cyan" />
                <span>
                  <strong>{t.ticker}</strong>
                  <small>{t.name} · {t.chain.toUpperCase()}</small>
                </span>
                <span className={t.priceChange24h >= 0 ? "positive" : "negative"}>{signedPct(t.priceChange24h)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topActions">
        {/* Alerts */}
        <div style={{ position: "relative" }}>
          <button className="topButton" type="button" onClick={() => setAlertsOpen(o => !o)}>
            <Bell size={16} /> Alerts {alertCount > 0 && <span>{alertCount}</span>}
          </button>
          {alertsOpen && (
            <div className="navDropdown" onMouseLeave={() => setAlertsOpen(false)}>
              <div className="navDropdownTitle">Alert Summary</div>
              {alertCount === 0
                ? <div className="navDropdownEmpty">No alerts — indexer running</div>
                : <div className="navDropdownItem"><Bell size={13} /><span>{alertCount} active alerts</span></div>
              }
              <div className="navDropdownFooter">Full alerts panel coming soon</div>
            </div>
          )}
        </div>

        {/* Watchlist */}
        <button className="topButton" type="button" onClick={onWatchlistClick}>
          <Star size={16} /> Watchlist
        </button>

        {/* RainbowKit wallet connect */}
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {connected && (
                  <button
                    className="walletButton"
                    type="button"
                    onClick={openChainModal}
                    title="Switch network"
                    style={{ padding: "0 8px", gap: 5 }}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img src={chain.iconUrl} alt={chain.name} style={{ width: 16, height: 16, borderRadius: "50%" }} />
                    )}
                    {chain.name}
                  </button>
                )}
                <button
                  className="walletButton"
                  type="button"
                  onClick={connected ? openAccountModal : openConnectModal}
                >
                  <TokenLogo
                    label={connected ? account.displayName.slice(0, 2).toUpperCase() : "0x"}
                    tone="blue"
                  />
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

function Sidebar({ activeItem, pendingItem, onNavigate }: {
  activeItem: string;
  pendingItem: string | null;
  onNavigate: (label: string) => void;
}) {
  return (
    <aside className="sidebar">
      <nav aria-label="Dashboard">
        {navSections.map((section) => (
          <div className="navSection" key={section.title || "primary"}>
            {section.title ? <span className="navSectionTitle">{section.title}</span> : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active  = activeItem  === item.label;
              const pending = pendingItem === item.label;
              return (
                <button
                  className={`sideNavItem${active ? " active" : ""}${pending ? " pending" : ""}`}
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.label)}
                  aria-busy={pending || undefined}
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

function TrendingTicker({ tokens, onSelect }: { tokens: RadarToken[]; onSelect: (token: RadarToken) => void }) {
  const router = useRouter();
  const tickerTokens = [...tokens, ...tokens, ...tokens];
  return (
    <section className="trendingTicker" aria-label="Trending tokens">
      <div className="tickerLead"><TrendingUp size={15} /> Trending <ChevronDown size={13} /></div>
      <div className="tickerViewport">
        <div className="tickerRail">
          {tickerTokens.map((token, index) => (
            <button className="tickerToken" key={`${token.address}-${index}`} type="button" onClick={() => onSelect(token)}>
              <TokenLogo label={token.ticker} tone={logoPalette[index % logoPalette.length]} />
              <strong>{token.ticker}</strong>
              <span className={token.priceChange24h >= 0 ? "positive" : "negative"}>{signedPct(token.priceChange24h)}</span>
              <small>{money(token.volume24hUsd)}</small>
            </button>
          ))}
        </div>
      </div>
      <button className="viewAllButton" type="button" onClick={() => { dispatchNavStart(); router.push("/launches"); }}>View all <ArrowRight size={15} /></button>
    </section>
  );
}

const SPEED_OPTIONS: Array<{ value: 0.5 | 1 | 2 | 5; label: string }> = [
  { value: 0.5, label: "0.5× Slow" },
  { value: 1,   label: "1× Normal" },
  { value: 2,   label: "2× Fast" },
  { value: 5,   label: "5× Turbo" },
];
const RISK_FILTERS: Array<{ value: string; label: string }> = [
  { value: "Low",     label: "Low Risk" },
  { value: "Medium",  label: "Medium Risk" },
  { value: "High",    label: "High Risk" },
  { value: "Extreme", label: "Extreme Risk" },
];

function LaunchRadar({
  tokens, selected, chain, live, speed, filterRisks,
  onChainChange, onLiveChange, onSpeedChange, onFilterChange, onSelect,
}: {
  tokens: RadarToken[];
  selected?: RadarToken;
  chain: "all" | ChainKey;
  live: boolean;
  speed: 0.5 | 1 | 2 | 5;
  filterRisks: Set<string>;
  onChainChange: (chain: "all" | ChainKey) => void;
  onLiveChange: (live: boolean) => void;
  onSpeedChange: (s: 0.5 | 1 | 2 | 5) => void;
  onFilterChange: (risks: Set<string>) => void;
  onSelect: (token: RadarToken) => void;
}) {
  const radarRef = useRef<HTMLElement>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      radarRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleRiskFilter = useCallback((risk: string) => {
    const next = new Set(filterRisks);
    next.has(risk) ? next.delete(risk) : next.add(risk);
    onFilterChange(next);
  }, [filterRisks, onFilterChange]);

  const calloutTokens = tokens.slice(0, 5);
  return (
    <section className="radarPanel" ref={radarRef} aria-label="Launch Radar">
      <div className="radarHeader">
        <div>
          <h1>Launch Radar</h1>
          <span className="livePill"><i /> {live ? "Live" : "Paused"}</span>
        </div>
        <div className="radarLegend" aria-label="Risk legend">
          <LegendDot type="healthy" label="Healthy" />
          <LegendDot type="watch" label="Watch" />
          <LegendDot type="high-risk" label="High Risk" />
          <LegendDot type="smart-money" label="Smart Money" />
          <LegendDot type="viral" label="Viral" />
        </div>
        <div className="radarControls">
          <div className="chainSwitch" role="group" aria-label="Chain filter">
            {chainOptions.map((option) => (
              <button className={chain === option ? "selected" : ""} key={option} type="button" onClick={() => onChainChange(option)}>
                {option.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Risk filter */}
          <div style={{ position: "relative" }}>
            <button
              className={`iconButton ${filterRisks.size > 0 ? "active" : ""}`}
              type="button"
              aria-label="Filter by risk"
              onClick={() => setFilterOpen(o => !o)}
            >
              <Filter size={16} />
              {filterRisks.size > 0 && <span style={{ fontSize: 9, marginLeft: 2 }}>{filterRisks.size}</span>}
            </button>
            {filterOpen && (
              <div className="radarDropdown" onMouseLeave={() => setFilterOpen(false)}>
                <div className="radarDropdownTitle">Filter by Risk</div>
                {RISK_FILTERS.map(({ value, label }) => (
                  <button key={value} type="button" className={`radarDropdownItem ${filterRisks.has(value) ? "selected" : ""}`} onClick={() => toggleRiskFilter(value)}>
                    <span className={`riskDot ${value.toLowerCase()}`} />
                    {label}
                    {filterRisks.has(value) && <Check size={12} style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
                {filterRisks.size > 0 && (
                  <button type="button" className="radarDropdownClear" onClick={() => onFilterChange(new Set())}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button className={`iconButton ${isFullscreen ? "active" : ""}`} type="button" aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
            <Expand size={16} />
          </button>
        </div>
      </div>

      <div className="radarStage">
        <div className="starfield" />
        <div className="radarSweep" />
        <div className="radarCore" />
        <span className="axis north">N</span>
        <span className="axis east">E</span>
        <span className="axis south">S</span>
        <span className="axis west">W</span>
        {[25, 50, 75, 100].map((range) => <span className={`rangeLabel range${range}`} key={range}>{range}m</span>)}
        {tokens.map((token) => (
          <RadarDot key={token.address} token={token} selected={selected?.address === token.address} onSelect={onSelect} />
        ))}
        {calloutTokens.map((token, index) => (
          <button
            className={`radarCallout callout${index + 1}`}
            key={`callout-${token.address}`}
            type="button"
            onClick={() => onSelect(token)}
          >
            <TokenLogo label={token.ticker} tone={logoPalette[index % logoPalette.length]} />
            <span>
              <strong>{token.ticker}</strong>
              <small>{money(token.volume24hUsd)}</small>
              <em>{signedPct(token.priceChange24h)}</em>
            </span>
          </button>
        ))}
        <div className="radarMetric">
          <span>Tokens tracked</span>
          <strong>{tokens.length}</strong>
          <small>live</small>
        </div>
        <div className="playControls">
          <button className="iconButton" type="button" onClick={() => onLiveChange(!live)} aria-label={live ? "Pause" : "Play"}>
            {live ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div style={{ position: "relative" }}>
            <button className="speedButton" type="button" onClick={() => setSpeedOpen(o => !o)}>
              {speed}x <ChevronDown size={13} />
            </button>
            {speedOpen && (
              <div className="radarDropdown radarDropdownUp" onMouseLeave={() => setSpeedOpen(false)}>
                {SPEED_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`radarDropdownItem ${speed === value ? "selected" : ""}`}
                    onClick={() => { onSpeedChange(value); setSpeedOpen(false); }}
                  >
                    {label}
                    {speed === value && <Check size={12} style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RadarDot({ token, selected, onSelect }: { token: RadarToken; selected: boolean; onSelect: (token: RadarToken) => void }) {
  return (
    <button
      className={`radarDot ${token.radarType} ${selected ? "selected" : ""}`}
      style={{ left: `${token.radarX}%`, top: `${token.radarY}%`, width: token.radarSize, height: token.radarSize }}
      type="button"
      onClick={() => onSelect(token)}
      aria-label={`${token.ticker} ${token.riskLevel} risk`}
    >
      <span />
      <RadarTooltip token={token} />
    </button>
  );
}

function RadarTooltip({ token }: { token: RadarToken }) {
  return (
    <span className="radarTooltip">
      <strong>{token.ticker}</strong>
      <small>{money(token.volume24hUsd)} volume</small>
      <em>{signedPct(token.priceChange24h)}</em>
    </span>
  );
}

type DonutSegment = { label: string; value: number; color: string };

function MarketStatsPanel({
  tokens,
  liveSwaps,
  onTokenClick,
}: {
  tokens: RadarToken[];
  liveSwaps: LiveSwap[];
  onTokenClick: (token: RadarToken) => void;
}) {
  const router = useRouter();

  // Market-wide aggregates
  const totalVolume = tokens.reduce((s, t) => s + t.volume24hUsd, 0);
  const totalBuys = tokens.reduce((s, t) => s + t.buys, 0);
  const totalSells = tokens.reduce((s, t) => s + t.sells, 0);
  const totalSwaps = totalBuys + totalSells;
  const buyPct = totalSwaps > 0 ? Math.round((totalBuys / totalSwaps) * 100) : 50;
  const sentiment = buyPct >= 55 ? "bullish" : buyPct <= 45 ? "bearish" : "neutral";

  // Risk distribution donut segments
  const riskSegments: DonutSegment[] = [
    { label: "Low",    value: tokens.filter((t) => t.riskLevel === "Low").length,     color: "oklch(0.62 0.22 151)" },
    { label: "Med",    value: tokens.filter((t) => t.riskLevel === "Medium").length,  color: "oklch(0.78 0.17 85)"  },
    { label: "High",   value: tokens.filter((t) => t.riskLevel === "High").length,    color: "oklch(0.62 0.22 25)"  },
    { label: "Ext",    value: tokens.filter((t) => t.riskLevel === "Extreme").length, color: "oklch(0.48 0.18 25)"  },
  ];

  // Chain volume split donut segments
  const chainVols: Record<string, number> = {};
  tokens.forEach((t) => { chainVols[t.chain] = (chainVols[t.chain] ?? 0) + t.volume24hUsd; });
  const chainSegments: DonutSegment[] = [
    { label: "Base", value: chainVols["base"] ?? 0, color: "oklch(0.62 0.22 220)" },
    { label: "ETH",  value: chainVols["eth"]  ?? 0, color: "oklch(0.68 0.16 285)" },
    { label: "BSC",  value: chainVols["bsc"]  ?? 0, color: "oklch(0.78 0.17 85)"  },
  ];

  // Radar insights
  const highRisk = tokens.filter((t) => t.riskLevel === "High" || t.riskLevel === "Extreme").length;
  const topGainer = tokens.length > 0
    ? [...tokens].sort((a, b) => b.priceChange1h - a.priceChange1h)[0]
    : null;
  const totalLiquidity = tokens.reduce((s, t) => s + t.liquidityUsd, 0);
  const marketBullish = buyPct >= 55;

  return (
    <aside className="tokenPanel statsPanel">
      {/* Header */}
      <div className="spHead">
        <span className="spTitle">Market Pulse</span>
        <span className="spLive"><i className="spLiveOrb" />Live</span>
      </div>

      {/* Pulse strip */}
      <div className="spPulse">
        <div className="spPulseStat">
          <span>Tokens</span>
          <strong>{tokens.length}</strong>
          <small>tracked</small>
        </div>
        <div className="spPulseStat">
          <span>Volume 24h</span>
          <strong>{money(totalVolume)}</strong>
          <small>combined</small>
        </div>
        <div className="spPulseStat">
          <span>Buy Side</span>
          <strong className={buyPct >= 50 ? "positive" : "negative"}>{buyPct}%</strong>
          <small>{sentiment}</small>
        </div>
      </div>

      {/* Buy/Sell pressure bar */}
      <div className="spPressure">
        <div className="spPressureBar">
          <div className="spPressureBuy" style={{ width: `${buyPct}%` }} />
          <div className="spPressureSell" />
        </div>
        <div className="spPressureLabels">
          <span className="positive">{totalBuys.toLocaleString()} buys</span>
          <span className="negative">{totalSells.toLocaleString()} sells</span>
        </div>
      </div>

      {/* Donut pair */}
      <div className="spDonutRow">
        <div className="spDonut">
          <span className="spDonutTitle">Risk Mix</span>
          <DonutChart segments={riskSegments} centerLabel={`${tokens.length}`} centerSub="tokens" />
          <div className="spDonutLegend">
            {riskSegments.filter((s) => s.value > 0).map((s) => (
              <span key={s.label} className="spLegendItem">
                <i style={{ background: s.color }} />{s.label} <b>{s.value}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="spDonut">
          <span className="spDonutTitle">Chain Split</span>
          <DonutChart segments={chainSegments} centerLabel={money(totalVolume)} centerSub="vol" />
          <div className="spDonutLegend">
            {chainSegments.filter((s) => s.value > 0).map((s) => (
              <span key={s.label} className="spLegendItem">
                <i style={{ background: s.color }} />{s.label} <b>{money(s.value)}</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Volume by Chain bar chart */}
      <div className="spSection">
        <h3 className="spSectionTitle"><Database size={13} />Volume by Chain</h3>
        <div className="spVolBars">
          {chainSegments.map((seg) => {
            const pct = totalVolume > 0 ? (seg.value / totalVolume) * 100 : 0;
            return (
              <div key={seg.label} className="spVolBar">
                <span className="spVolBarLabel">{seg.label}</span>
                <div className="spVolBarTrack">
                  <div className="spVolBarFill" style={{ width: `${pct}%`, background: seg.color }} />
                </div>
                <span className="spVolBarValue">{money(seg.value)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Age vs Volume bubble plot */}
      <div className="spSection">
        <h3 className="spSectionTitle"><Activity size={13} />Age vs Volume</h3>
        <BubblePlot tokens={tokens} onTokenClick={onTokenClick} />
        <div className="spBubbleLegend">
          {(["healthy", "watch", "smart-money", "viral", "high-risk"] as RadarType[]).map((type) => (
            <span key={type} className="spBubbleLegendItem">
              <i className={`spBubbleDot ${type}`} />{type.replace("-", " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Radar Insights */}
      <div className="spSection">
        <h3 className="spSectionTitle"><Gauge size={13} />Radar Insights</h3>
        <div className="spInsightList">
          <div className={`spInsight ${topGainer && topGainer.priceChange1h > 0 ? "green" : "red"}`}>
            <span><TrendingUp size={14} /></span>
            <div>
              <strong>
                {topGainer
                  ? `${topGainer.ticker} ${topGainer.priceChange1h >= 0 ? "up" : "down"} ${Math.abs(topGainer.priceChange1h).toFixed(1)}% (1h)`
                  : "No price data yet"}
              </strong>
              <small>
                {topGainer
                  ? `Vol: ${money(topGainer.volume24hUsd)} · ${topGainer.buys}B / ${topGainer.sells}S`
                  : "Run indexer to populate"}
              </small>
            </div>
          </div>
          <div className={`spInsight ${highRisk > 0 ? "red" : "green"}`}>
            <span><AlertTriangle size={14} /></span>
            <div>
              <strong>
                {tokens.length === 0
                  ? "No tokens indexed yet"
                  : highRisk > 0
                    ? `${highRisk} high-risk token${highRisk > 1 ? "s" : ""} detected`
                    : "No high-risk tokens in view"}
              </strong>
              <small>
                {tokens.length > 0
                  ? `${tokens.length} scanned · ${tokens.filter(t => t.riskLevel === "Low").length} low-risk`
                  : "Waiting for indexer data"}
              </small>
            </div>
          </div>
          <div className={`spInsight ${marketBullish ? "cyan" : "amber"}`}>
            <span><Droplets size={14} /></span>
            <div>
              <strong>
                {totalSwaps > 0
                  ? `${buyPct}% buy pressure · ${marketBullish ? "Bullish" : "Bearish"}`
                  : "Awaiting swap data"}
              </strong>
              <small>
                {totalLiquidity > 0
                  ? `${money(totalLiquidity)} liquidity · ${totalSwaps} swaps`
                  : totalSwaps > 0
                    ? `${totalBuys} buys · ${totalSells} sells`
                    : "Run indexer to see signals"}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Money Flow */}
      <div className="spSection">
        <h3 className="spSectionTitle"><Wallet size={13} />Smart Money Flow</h3>
        <div className="spSwapList">
          {liveSwaps.length === 0 ? (
            <div className="spEmpty">No swap data yet — run indexer</div>
          ) : liveSwaps.slice(0, 8).map((swap) => {
            const t0 = resolvedSymbol(swap.token0Symbol, swap.token0 ?? swap.poolAddress ?? "");
            const t1 = resolvedSymbol(swap.token1Symbol, swap.token1 ?? "");
            const pair = t1 && t1 !== "ETH" ? `${t0}/${t1}` : t0;
            const walletAddr = swap.sender ?? swap.txHash;
            const isFullAddr = /^0x[a-fA-F0-9]{40}$/.test(walletAddr);
            const isBuy = swap.amount0Raw.startsWith("-");
            return (
              <div className="spSwapRow" key={`${swap.chain}-${swap.txHash}-${swap.blockNumber}`}>
                <span className={`spSwapBadge ${isBuy ? "buy" : "sell"}`}>{isBuy ? "B" : "S"}</span>
                <div className="spSwapBody">
                  <strong>{pair}</strong>
                  <button
                    type="button"
                    className="spSwapWallet"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFullAddr) router.push(`/wallet/${walletAddr}`);
                      else window.open(addressUrl(swap.chain, walletAddr), "_blank");
                    }}
                  >
                    {shortAddress(walletAddr)}
                  </button>
                </div>
                <span className="spSwapChain">{swap.chain}</span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function DonutChart({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerSub: string;
}) {
  const size = 90;
  const r = 30;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let accumulated = 0;
  const arcs = total === 0
    ? []
    : segments
        .filter((s) => s.value > 0)
        .map((seg) => {
          const dash = (seg.value / total) * circumference;
          const offset = circumference / 4 - accumulated;
          accumulated += dash;
          return { ...seg, dash, offset };
        });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {arcs.length === 0 ? (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="oklch(0.22 0.02 255)"
          strokeWidth="10"
        />
      ) : arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="10"
          strokeLinecap="butt"
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset}
        />
      ))}
      {/* Gap ring for visual separation between segments */}
      {arcs.length > 1 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.11 0.015 258)" strokeWidth="2" />
      )}
      <text
        x={cx} y={cy - 3}
        textAnchor="middle"
        dominantBaseline="auto"
        style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)", fontFamily: "inherit" }}
      >
        {centerLabel}
      </text>
      <text
        x={cx} y={cy + 9}
        textAnchor="middle"
        style={{ fontSize: 8, fill: "var(--muted)", fontFamily: "inherit" }}
      >
        {centerSub}
      </text>
    </svg>
  );
}

const RADAR_TYPE_COLOR: Record<RadarType, string> = {
  "healthy":     "oklch(0.62 0.22 151)",
  "watch":       "oklch(0.72 0.13 207)",
  "high-risk":   "oklch(0.62 0.22 25)",
  "smart-money": "oklch(0.62 0.22 285)",
  "viral":       "oklch(0.78 0.17 85)",
};

function BubblePlot({ tokens, onTokenClick }: { tokens: RadarToken[]; onTokenClick: (t: RadarToken) => void }) {
  if (tokens.length === 0) {
    return <div className="spEmpty" style={{ padding: "20px 0" }}>No token data — run indexer</div>;
  }

  const W = 320;
  const H = 148;
  const PAD = { t: 8, r: 8, b: 20, l: 36 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const maxAge = Math.max(...tokens.map(t => t.ageMinutes), 1);
  const maxVol = Math.max(...tokens.map(t => t.volume24hUsd), 1);
  const maxMcap = Math.max(...tokens.map(t => t.marketCapUsd), 1);

  const yTicks = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-label="Age vs Volume bubble chart"
    >
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD.t + plotH * (1 - f);
        return <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="oklch(0.22 0.02 255)" strokeWidth="0.5" />;
      })}
      {/* Axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} stroke="oklch(0.28 0.03 255)" strokeWidth="1" />
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="oklch(0.28 0.03 255)" strokeWidth="1" />
      {/* Y labels */}
      {yTicks.map(f => (
        <text
          key={f}
          x={PAD.l - 3}
          y={PAD.t + plotH * (1 - f)}
          textAnchor="end"
          dominantBaseline="middle"
          style={{ fontSize: 7, fill: "oklch(0.40 0.04 255)", fontFamily: "inherit" }}
        >
          {f === 0 ? "$0" : money(f * maxVol)}
        </text>
      ))}
      {/* X axis label */}
      <text
        x={PAD.l + plotW / 2}
        y={H - 3}
        textAnchor="middle"
        style={{ fontSize: 7, fill: "oklch(0.40 0.04 255)", fontFamily: "inherit" }}
      >
        Age (minutes) →
      </text>
      {/* Bubbles */}
      {tokens.map(t => {
        const cx = PAD.l + (t.ageMinutes / maxAge) * plotW;
        const cy = PAD.t + plotH - (t.volume24hUsd / maxVol) * plotH;
        const r = Math.max(3, Math.min(10, 3 + (t.marketCapUsd / maxMcap) * 7));
        const color = RADAR_TYPE_COLOR[t.radarType];
        return (
          <circle
            key={t.id}
            cx={cx} cy={cy} r={r}
            fill={color}
            fillOpacity={0.6}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.9}
            style={{ cursor: "pointer" }}
            onClick={() => onTokenClick(t)}
          >
            <title>{t.ticker} · {t.age} · {money(t.volume24hUsd)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function ComingSoonPanel({ label, onClose }: { label: string; onClose: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    "DEX Pools":          <Layers size={32} />,
    "Liquidity Locks":    <Lock size={32} />,
    "Contract Analyzer":  <Database size={32} />,
    "Opportunities":      <Gem size={32} />,
    "Alerts":             <Bell size={32} />,
  };
  return (
    <aside className="tokenPanel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: "50%", background: "oklch(0.18 0.05 285)", color: "var(--violet)", border: "1px solid oklch(0.62 0.22 285 / 0.35)" }}>
        {icons[label] ?? <Zap size={32} />}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, maxWidth: 240 }}>
          This feature is under active development and will be available soon.
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 14px", borderRadius: 999, border: "1px solid oklch(0.62 0.22 285 / 0.5)", color: "var(--violet)", background: "oklch(0.18 0.05 285)" }}>
        Coming Soon
      </span>
      <button
        type="button"
        className="panelLink"
        onClick={onClose}
        style={{ marginTop: 8 }}
      >
        ← Back to Radar <ArrowRight size={15} />
      </button>
    </aside>
  );
}

function WatchlistPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${api}/api/smart-money/leaderboard?limit=10`)
      .then(r => r.json())
      .then(d => setLeaderboard(d.data ?? []))
      .catch(() => {});
  }, []);

  const topWallets = leaderboard.slice(0, 5);
  const recentWallets = leaderboard.slice(0, 3);

  function fmtLastSeen(iso: string | null): string {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <aside className="tokenPanel" style={{ overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
          Top Smart Wallets
        </span>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 7, marginBottom: 20, paddingRight: 2 }}>
        {topWallets.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
            No smart wallets yet — run indexer:smart-wallets
          </div>
        ) : topWallets.map((w, i) => (
          <button
            key={w.wallet}
            type="button"
            onClick={() => router.push(`/wallet/${w.wallet}`)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid var(--line-soft)", borderRadius: 8, background: "oklch(0.12 0.018 255)", cursor: "pointer", textAlign: "left", width: "100%" }}
          >
            <span style={{ color: "var(--faint)", fontSize: 11, width: 16, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--cyan)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Score {w.score} · {w.totalClosedTrades > 0 ? `${w.winRatePct}% win rate` : "tracking"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>
              <Eye size={11} />
              {w.score}
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 10 }}>
        Recently Active
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {recentWallets.length === 0 ? (
          <div style={{ color: "var(--faint)", fontSize: 12, padding: "8px 0", textAlign: "center" }}>No data yet</div>
        ) : recentWallets.map((w) => (
          <button
            key={w.wallet}
            type="button"
            onClick={() => router.push(`/wallet/${w.wallet}`)}
            style={{ padding: "10px 12px", border: "1px solid var(--line-soft)", borderRadius: 8, background: "oklch(0.12 0.018 255)", cursor: "pointer", textAlign: "left", width: "100%" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--cyan)" }}>
                {w.wallet.slice(0, 8)}…{w.wallet.slice(-4)}
              </span>
              <span style={{ fontSize: 10, color: "var(--faint)" }}>{fmtLastSeen(w.lastSeenAt)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>
              Rank #{w.rank} · Score {w.score}
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Trades</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{w.totalTrades}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Win Rate</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                  {w.totalClosedTrades > 0 ? `${w.winRatePct}%` : "—"}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button className="panelLink" type="button" onClick={() => router.push("/smart-money")} style={{ marginTop: 16 }}>
        View Smart Money Board <ArrowRight size={15} />
      </button>
    </aside>
  );
}

function LatestLaunchesCard({ tokens, onSelect }: { tokens: RadarToken[]; onSelect: (token: RadarToken) => void }) {
  const router = useRouter();
  return (
    <section className="dataPanel latestLaunches">
      <PanelTitle icon={<Zap size={16} />} title="Latest Launches" />
      <div className="llScroll">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Chain</th>
              <th>Age</th>
              <th>MCap</th>
              <th>Vol</th>
              <th>Risk</th>
              <th>Smart Money</th>
            </tr>
          </thead>
          <tbody>
            {tokens.slice(0, 20).map((token, index) => (
              <tr key={token.address} onClick={() => onSelect(token)} style={{ cursor: "pointer" }}>
                <td>
                  <span className="rank">{index + 1}</span>
                  <TokenLogo label={token.ticker} tone={logoPalette[index % logoPalette.length]} />
                  <span className="tokenLink">
                    <strong>{token.ticker}</strong>
                  </span>
                </td>
                <td><ChainBadge chain={token.chain} /></td>
                <td>{token.age}</td>
                <td>{money(token.marketCapUsd)}</td>
                <td>{money(token.volume24hUsd)}</td>
                <td><RiskBadge level={token.riskLevel} /></td>
                <td>
                  {token.smartWalletBuys > 0
                    ? <span className={`signalPill ${token.smartWalletBuys >= 12 ? "green" : "amber"}`}>
                        {token.smartWalletBuys} wallet{token.smartWalletBuys !== 1 ? "s" : ""}
                      </span>
                    : <span style={{ color: "var(--faint)", fontSize: 11 }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="panelLink" type="button" onClick={() => { dispatchNavStart(); router.push("/launches"); }}>View All Launches <ArrowRight size={15} /></button>
    </section>
  );
}

function HighConvictionCard({ tokens, onSelect }: { tokens: RadarToken[]; onSelect: (token: RadarToken) => void }) {
  const picks = tokens
    .filter(t =>
      (t.riskLevel === "Low" || t.riskLevel === "Medium") &&
      t.smartWalletBuys > 0 &&
      t.priceChange1h > 0,
    )
    .sort((a, b) => b.smartWalletBuys - a.smartWalletBuys || b.priceChange1h - a.priceChange1h)
    .slice(0, 20);

  return (
    <section className="dataPanel highConviction">
      <PanelTitle icon={<Gem size={16} />} title="High Conviction" />
      <div className="hcScroll">
        {picks.length === 0 ? (
          <div className="hcEmpty">No high conviction setups right now</div>
        ) : picks.map((token, i) => (
          <div key={token.id} className="hcRow" onClick={() => onSelect(token)}>
            <span className="rank">{i + 1}</span>
            <TokenLogo label={token.ticker} tone={logoPalette[i % logoPalette.length]} />
            <div className="hcMain">
              <div className="hcTokenHead">
                <strong>{token.ticker}</strong>
                <ChainBadge chain={token.chain} />
                <span className="hcAge">{token.age}</span>
              </div>
              <div className="hcSignals">
                <span className={`hcSignal ${token.riskLevel === "Low" ? "low" : "med"}`}>
                  {token.riskLevel} Risk
                </span>
                <span className="hcSignal smart">
                  {token.smartWalletBuys} smart wallet{token.smartWalletBuys !== 1 ? "s" : ""}
                </span>
                <span className="hcSignal momentum">
                  +{token.priceChange1h.toFixed(1)}% 1h
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="panelTitle">{icon}{title}</h2>;
}

function LegendDot({ type, label }: { type: RadarType; label: string }) {
  return <span className={`legendDot ${type}`}><i /> {label}</span>;
}

function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`riskBadge ${level.toLowerCase()}`}>{level}</span>;
}

function ChainBadge({ chain }: { chain: ChainKey }) {
  return <span className={`chainBadge ${chain}`}>{chain}</span>;
}

function LaunchSourceBadge({ source }: { source: string }) {
  return <span className="sourceBadge">{source}</span>;
}

function TokenLogo({ label, tone, large = false }: { label: string; tone: string; large?: boolean }) {
  return (
    <span className={`tokenLogo ${tone} ${large ? "large" : ""}`}>
      <Hexagon size={large ? 24 : 15} />
      <b>{label.slice(0, 2).toUpperCase()}</b>
    </span>
  );
}

/* ── helpers ── */

function enrichTokens(tokens: TokenSummary[]): RadarToken[] {
  return tokens.map((token, index) => {
    const type = radarType(token, index);

    // Distance from centre = age (inner = newest, outer = oldest)
    // Rings are labelled 25m / 50m / 75m / 100m — map ageMinutes accordingly.
    // Keep within 8–68% radius so dots stay inside the disc.
    const ageClamped = Math.min(token.ageMinutes, 100);
    const radius = 8 + (ageClamped / 100) * 60; // 8% – 68%

    // Angle: spread tokens evenly around the circle, seeded by address so
    // the same token always lands at the same angle across refreshes.
    const addrSeed = parseInt(token.address.slice(-4), 16) / 0xffff; // 0–1
    const chainOffset = token.chain === "eth" ? 120 : token.chain === "bsc" ? 240 : 0;
    const angleBase = (index / Math.max(tokens.length, 1)) * 360 + chainOffset;
    const angleDeg = (angleBase + addrSeed * 40 - 20 + 360) % 360; // ±20° jitter
    const angleRad = (angleDeg * Math.PI) / 180;

    // Convert polar → CSS percentages (origin = 50%, 50%)
    const radarX = Math.round(50 + radius * Math.cos(angleRad));
    const radarY = Math.round(50 + radius * Math.sin(angleRad));

    return {
      ...token,
      id: `${token.chain}-${token.address}`,
      ticker: token.symbol,
      age: formatAge(token.ageMinutes),
      buyers: token.uniqueBuyers,
      sellers: token.uniqueSellers,
      holderGrowth: Math.max(4.2, Math.min(38, token.newHolders24h / Math.max(1, token.holders) * 100)),
      liquidityLocked: token.riskLevel === "Low" ? 100 : token.riskLevel === "Medium" ? 82 : 48,
      radarX,
      radarY,
      radarSize: Math.max(16, Math.min(42, 16 + token.volume24hUsd / 12000)),
      radarType: type,
      signalStrength: Math.round((token.trendingScore + token.smartWalletBuys * 2) / 1.2),
    };
  });
}

function radarType(token: TokenSummary, index: number): RadarType {
  if (token.riskLevel === "High" || token.riskLevel === "Extreme") return "high-risk";
  if (token.smartWalletBuys >= 12) return "smart-money";
  if (token.trendingScore >= 80) return "viral";
  if (index % 3 === 0) return "watch";
  return "healthy";
}


function signedPct(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) {
    const k = Math.round(value / 1_000);
    return k >= 1000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${k}K`;
  }
  return `$${Math.round(value)}`;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function shortAddress(value: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolvedSymbol(symbol: string | null | undefined, address: string) {
  if (symbol && symbol !== "UNKNOWN") return symbol;
  if (!address || address === "0x0000000000000000000000000000000000000000") return "ETH";
  return shortAddress(address);
}

function explorerRoot(chain: ChainKey) {
  if (chain === "base") return "https://basescan.org";
  if (chain === "eth") return "https://etherscan.io";
  return "https://bscscan.com";
}

function addressUrl(chain: ChainKey, address: string) { return `${explorerRoot(chain)}/address/${address}`; }
function txUrl(chain: ChainKey, hash: string) { return `${explorerRoot(chain)}/tx/${hash}`; }

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d`;
}
