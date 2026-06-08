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
  Copy,
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
import type { Candle, ChainKey, LivePool, LiveSwap, RiskLevel, TokenSummary } from "../lib/types";
import { fetchLiveData, fetchTokenCandles, fetchTokenSwaps, subscribeLiveFeed } from "../lib/api";
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


type RightPanel = "token" | "watchlist" | "coming-soon";

const chainOptions: Array<"all" | ChainKey> = ["all", "base", "eth", "bsc"];
const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

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
  const [rightPanel, setRightPanel] = useState<RightPanel>("token");
  const [activeNav, setActiveNav] = useState("Radar");
  const [comingSoonLabel, setComingSoonLabel] = useState("");
  // Tracks which sidebar item is mid-navigation so we can show a pending state
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  // Starred tokens — persisted to localStorage
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { const s = localStorage.getItem("cs:starred"); if (s) setStarred(JSON.parse(s)); } catch {}
  }, []);

  // Clear the sidebar loading indicator once the new route has mounted
  useEffect(() => { setPendingNav(null); }, [pathname]);
  const toggleStar = useCallback((id: string) => {
    setStarred(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("cs:starred", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
  const [selected, setSelected] = useState<RadarToken | undefined>(radarTokens[0]);

  const showTokenInPanel = useCallback((token: RadarToken) => {
    setSelected(token);
    setRightPanel("token");
    setActiveNav("Radar");
  }, []);

  const openTokenPage = useCallback((token: RadarToken) => {
    dispatchNavStart();
    router.push(`/token/${token.chain}/${token.address}`);
  }, [router]);

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
    if (label === "Radar")     { setRightPanel("token"); }
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

  const selectedToken = selected && visibleTokens.some((t) => t.address === selected.address)
    ? selected
    : visibleTokens[0];

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
            selected={selectedToken}
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
            <SmartMoneyFlowCard swaps={liveSwaps} />
            <RadarInsightsCard selected={selectedToken} tokens={visibleTokens} />
            <LivePoolsCard pools={livePools} tokens={visibleTokens} />
          </section>
        </main>
        {rightPanel === "watchlist"
          ? <WatchlistPanel onClose={() => { setRightPanel("token"); setActiveNav("Radar"); }} />
          : rightPanel === "coming-soon"
          ? <ComingSoonPanel label={comingSoonLabel} onClose={() => { setRightPanel("token"); setActiveNav("Radar"); }} />
          : <TokenDetailPanel
              token={selectedToken}
              onOpenPage={openTokenPage}
              onClose={() => setSelected(undefined)}
              starred={starred}
              onToggleStar={toggleStar}
            />
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

function TokenDetailPanel({ token, onOpenPage, onClose, starred, onToggleStar }: {
  token?: RadarToken;
  onOpenPage: (token: RadarToken) => void;
  onClose: () => void;
  starred: Record<string, boolean>;
  onToggleStar: (id: string) => void;
}) {
  const [timeframe, setTimeframe] = useState("1h");
  const [copied, setCopied] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setCandles([]); return; }
    fetchTokenCandles(token.chain, token.address, timeframe).then(setCandles);
  }, [token?.chain, token?.address, timeframe]);

  useEffect(() => {
    if (!token) { setPoolAddress(null); return; }
    fetchTokenSwaps(token.chain, token.address, 1).then((swaps) => {
      setPoolAddress(swaps[0]?.poolAddress ?? null);
    });
  }, [token?.chain, token?.address]);

  const copyAddress = useCallback(() => {
    if (!token) return;
    navigator.clipboard.writeText(token.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [token]);

  if (!token) {
    return <aside className="tokenPanel emptyPanel">Select a token</aside>;
  }

  return (
    <aside className="tokenPanel">
      <div className="tokenPanelHead">
        <TokenLogo label={token.ticker} tone="cyan" large />
        <div>
          <strong>{token.ticker}</strong>
          <span>{token.name}</span>
          <div className="badgeRow">
            <ChainBadge chain={token.chain} />
            <LaunchSourceBadge source={token.launchSource} />
          </div>
        </div>
        <button
          className={`panelIcon ${starred[token.id] ? "starred" : ""}`}
          type="button"
          aria-label={starred[token.id] ? "Remove from watchlist" : "Add to watchlist"}
          onClick={() => onToggleStar(token.id)}
        >
          <Star size={18} fill={starred[token.id] ? "currentColor" : "none"} />
        </button>
        <button className="panelIcon" type="button" aria-label="Close token panel" onClick={onClose}><X size={18} /></button>
      </div>

      {/* Contract address */}
      <div className="contractRow">
        <span>Contract</span>
        <a className="contractAddress" href={addressUrl(token.chain, token.address)} target="_blank" rel="noopener noreferrer" title={token.address}>
          {shortAddress(token.address)}
        </a>
        <button type="button" className="copyButton" onClick={copyAddress} aria-label="Copy contract address">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        <a className="copyButton" href={addressUrl(token.chain, token.address)} target="_blank" rel="noopener noreferrer" aria-label="View on explorer">
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Pair address */}
      {poolAddress && (
        <div className="contractRow" style={{ marginTop: 6 }}>
          <span>Pair</span>
          <a className="contractAddress" href={addressUrl(token.chain, poolAddress)} target="_blank" rel="noopener noreferrer" title={poolAddress}>
            {shortAddress(poolAddress)}
          </a>
          <a className="copyButton" href={addressUrl(token.chain, poolAddress)} target="_blank" rel="noopener noreferrer" aria-label="View pair on explorer">
            <ExternalLink size={13} />
          </a>
        </div>
      )}

      <div className="priceBlock">
        <strong>${token.priceUsd.toFixed(token.priceUsd < 0.01 ? 6 : 4)}</strong>
        <span className={token.priceChange24h >= 0 ? "positive" : "negative"}>{signedPct(token.priceChange24h)}</span>
        <em><i /> Live</em>
      </div>

      <div className="metricStrip">
        <DetailStat label="Market Cap" value={money(token.marketCapUsd)} />
        <DetailStat label="Volume (24H)" value={money(token.volume24hUsd)} />
        <DetailStat label="Liquidity" value={money(token.liquidityUsd)} />
        <DetailStat label="Holders" value={compact(token.holders)} />
      </div>

      <div className="timeframeRow">
        {timeframes.map((item) => (
          <button className={timeframe === item ? "selected" : ""} key={item} type="button" onClick={() => setTimeframe(item)}>{item}</button>
        ))}
      </div>

      <MiniCandlestickChart token={token} candles={candles} />

      <div className="signalGrid">
        <GaugeCard label="Risk Score" value={token.riskScore} caption={`${token.riskLevel} Risk`} tone={riskTone(token.riskLevel)} />
        <GaugeCard label="Buyer Pressure" value={buyerPressure(token)} caption="Current" tone="cyan" />
        <SignalCard label="Smart Money Interest" value={token.smartWalletBuys > 12 ? "High" : "Building"} detail={`${token.smartWalletBuys} wallets`} tone="green" />
        <SignalCard label="Holder Growth (24H)" value={`+${token.holderGrowth.toFixed(1)}%`} detail={`${compact(token.holders)} holders`} tone="green" />
        <SignalCard label="Launch Source" value={token.launchSource} detail={`${token.chain.toUpperCase()} discovery`} tone="cyan" />
        <SignalCard label="Est. Lock" value={`${token.liquidityLocked}%`} detail={token.liquidityLocked > 80 ? "Strong lock" : "Monitor"} tone="green" />
      </div>

      <button className="primaryAction" type="button" onClick={() => onOpenPage(token)}>
        View Full Intelligence <ArrowRight size={16} />
      </button>
    </aside>
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
          {tokens.slice(0, 6).map((token, index) => (
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
      <button className="panelLink" type="button" onClick={() => { dispatchNavStart(); router.push("/launches"); }}>View All Launches <ArrowRight size={15} /></button>
    </section>
  );
}

function SmartMoneyFlowCard({ swaps }: { swaps: LiveSwap[] }) {
  const router = useRouter();
  const liveRows = swaps.slice(0, 5);

  return (
    <section className="dataPanel">
      <PanelTitle icon={<Wallet size={16} />} title="Smart Money Flow" />
      <div className="flowList">
        {liveRows.length ? liveRows.map((swap) => {
          const t0 = resolvedSymbol(swap.token0Symbol, swap.token0 ?? swap.poolAddress ?? "");
          const t1 = resolvedSymbol(swap.token1Symbol, swap.token1 ?? "");
          const pair = t1 ? `${t0}/${t1}` : t0;
          const walletAddr = swap.sender ?? swap.txHash;
          const isFullAddr = /^0x[a-fA-F0-9]{40}$/.test(walletAddr);
          // amount0Raw negative means token0 left the pool → user bought token0
          const isBuy = swap.amount0Raw.startsWith("-");
          return (
            <div className="flowRow liveSwapRow" key={`${swap.chain}-${swap.txHash}-${swap.blockNumber}`}>
              <button
                type="button"
                className="walletHash"
                title={walletAddr}
                onClick={() => isFullAddr ? router.push(`/wallet/${walletAddr}`) : window.open(addressUrl(swap.chain, walletAddr), "_blank")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", font: "inherit", color: "var(--cyan)" }}
              >
                {shortAddress(walletAddr)}
              </button>
              <b className={isBuy ? "buy" : "sell"}>{isBuy ? "BUY" : "SELL"}</b>
              <strong>{pair}</strong>
              <span>{swap.chain.toUpperCase()}</span>
              <a className="explorerLink muted" href={txUrl(swap.chain, swap.txHash)} target="_blank" rel="noopener noreferrer" title={swap.txHash}>
                #{swap.blockNumber}
              </a>
            </div>
          );
        }) : (
          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--faint)", fontSize: 12 }}>
            No swap activity yet — run the indexer
          </div>
        )}
      </div>
      <button className="panelLink" type="button" onClick={() => { dispatchNavStart(); router.push("/smart-money"); }}>View All Activity <ArrowRight size={15} /></button>
    </section>
  );
}

function RadarInsightsCard({ selected, tokens }: { selected?: RadarToken; tokens: RadarToken[] }) {
  const highRisk = tokens.filter((t) => t.riskLevel === "High" || t.riskLevel === "Extreme").length;

  // Top gainer by 1h change among visible tokens
  const topGainer = tokens.length > 0
    ? [...tokens].sort((a, b) => b.priceChange1h - a.priceChange1h)[0]
    : null;
  const momentumToken = selected ?? topGainer ?? null;
  const momentumPct = momentumToken?.priceChange1h ?? 0;
  const momentumPositive = momentumPct > 0;

  // Overall buy pressure (buys vs sells across all visible tokens)
  const totalBuys = tokens.reduce((s, t) => s + t.buys, 0);
  const totalSells = tokens.reduce((s, t) => s + t.sells, 0);
  const totalSwaps = totalBuys + totalSells;
  const buyPressurePct = totalSwaps > 0 ? Math.round((totalBuys / totalSwaps) * 100) : 50;
  const marketBullish = buyPressurePct >= 55;

  // Total on-chain liquidity across tracked tokens
  const totalLiquidity = tokens.reduce((s, t) => s + t.liquidityUsd, 0);
  const liquidityFmt = totalLiquidity >= 1_000_000
    ? `$${(totalLiquidity / 1_000_000).toFixed(1)}M`
    : totalLiquidity >= 1_000
      ? `$${(totalLiquidity / 1_000).toFixed(0)}K`
      : "$0";

  return (
    <section className="dataPanel">
      <PanelTitle icon={<Gauge size={16} />} title="Radar Insights" />
      <div className="insightList">
        <Insight
          icon={<TrendingUp size={16} />}
          tone={momentumPositive ? "green" : "red"}
          title={
            momentumToken
              ? `${momentumToken.ticker} ${momentumPositive ? "up" : "down"} ${Math.abs(momentumPct).toFixed(1)}% (1h)`
              : "No price data yet"
          }
          detail={
            momentumToken
              ? `Vol 24h: $${(momentumToken.volume24hUsd / 1000).toFixed(0)}K · ${momentumToken.buys}B / ${momentumToken.sells}S`
              : "Run indexer to populate"
          }
        />
        <Insight
          icon={<AlertTriangle size={16} />}
          tone={highRisk > 0 ? "red" : "green"}
          title={
            tokens.length === 0
              ? "No tokens indexed yet"
              : highRisk > 0
                ? `${highRisk} high-risk token${highRisk > 1 ? "s" : ""} detected`
                : "No high-risk tokens in current view"
          }
          detail={
            tokens.length > 0
              ? `${tokens.length} tokens scanned · ${tokens.filter(t => t.riskLevel === "Low").length} low-risk`
              : "Waiting for indexer data"
          }
        />
        <Insight
          icon={<Droplets size={16} />}
          tone={marketBullish ? "cyan" : "amber"}
          title={
            totalSwaps > 0
              ? `${buyPressurePct}% buy pressure · ${marketBullish ? "Bullish" : "Bearish"} sentiment`
              : "Awaiting swap data"
          }
          detail={
            totalLiquidity > 0
              ? `${liquidityFmt} total tracked liquidity · ${totalSwaps} swaps`
              : totalSwaps > 0
                ? `${totalBuys} buys · ${totalSells} sells across ${tokens.length} tokens`
                : "Run indexer to see signals"
          }
        />
      </div>
    </section>
  );
}

function LivePoolsCard({ pools, tokens }: { pools: LivePool[]; tokens: RadarToken[] }) {
  const totalVolume = tokens.reduce((sum, t) => sum + t.volume24hUsd, 0);
  const newest = pools.slice(0, 5);

  return (
    <section className="dataPanel livePools">
      <PanelTitle icon={<Database size={16} />} title="Live Chain Pools" />
      {newest.length ? (
        <div className="livePoolList">
          {newest.map((pool) => {
            const t0 = resolvedSymbol(pool.token0Symbol, pool.token0);
            const t1 = resolvedSymbol(pool.token1Symbol, pool.token1);
            const poolHref = pool.poolAddress ? addressUrl(pool.chain, pool.poolAddress) : null;
            const t0Href = pool.token0 && pool.token0 !== "0x0000000000000000000000000000000000000000" ? addressUrl(pool.chain, pool.token0) : null;
            const t1Href = pool.token1 && pool.token1 !== "0x0000000000000000000000000000000000000000" ? addressUrl(pool.chain, pool.token1) : null;
            return (
              <div className="livePoolRow" key={`${pool.chain}-${pool.txHash}-${pool.poolAddress ?? pool.poolId}`}>
                <div>
                  <strong>
                    {t0Href ? <a className="explorerLink" href={t0Href} target="_blank" rel="noopener noreferrer">{t0}</a> : t0}
                    {" / "}
                    {t1Href ? <a className="explorerLink" href={t1Href} target="_blank" rel="noopener noreferrer">{t1}</a> : t1}
                  </strong>
                  <span className="poolDex">
                    {pool.dexName} · {pool.protocolVersion.toUpperCase()}
                    {poolHref && (
                      <a className="explorerLink poolExplorer" href={poolHref} target="_blank" rel="noopener noreferrer" title={pool.poolAddress ?? ""}>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </span>
                </div>
                <ChainBadge chain={pool.chain} />
                <a className="explorerLink muted" href={txUrl(pool.chain, pool.txHash)} target="_blank" rel="noopener noreferrer" title={pool.txHash}>
                  #{pool.blockNumber}
                </a>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="statMosaic">
          <MosaicStat label="Live Pools" value="0" detail="waiting" />
          <MosaicStat label="Active Tokens" value={`${tokens.length}`} detail="seed view" />
          <MosaicStat label="Total Volume" value={money(totalVolume)} detail="demo tokens" />
          <MosaicStat label="Data Source" value="MySQL" detail="indexer" />
        </div>
      )}
    </section>
  );
}

function MiniCandlestickChart({ token, candles: realCandles }: { token: RadarToken; candles: Candle[] }) {
  const candles = useMemo(
    () => realCandles.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
    [realCandles],
  );

  if (!candles.length) {
    return (
      <div className="candlePanel" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)", fontSize: 11 }}>
        No chart data yet — indexer collecting candles
      </div>
    );
  }

  const max = Math.max(...candles.map((item) => item.high));
  const min = Math.min(...candles.map((item) => item.low));
  const spread = max - min || 1;

  return (
    <div className="candlePanel">
      <svg viewBox="0 0 320 156" role="img" aria-label={`${token.ticker} candlestick chart`}>
        <g className="chartGrid">
          {[24, 62, 100, 138].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} />)}
        </g>
        {candles.map((item, index) => {
          const x = 10 + index * 12;
          const highY = chartNumber(18 + ((max - item.high) / spread) * 88);
          const lowY = chartNumber(18 + ((max - item.low) / spread) * 88);
          const openY = chartNumber(18 + ((max - item.open) / spread) * 88);
          const closeY = chartNumber(18 + ((max - item.close) / spread) * 88);
          const up = item.close >= item.open;
          const bodyY = chartNumber(Math.min(openY, closeY));
          const bodyH = chartNumber(Math.max(3, Math.abs(closeY - openY)));
          const volumeH = chartNumber(8 + item.volume * 22);
          return (
            <g key={index} className={up ? "candleUp" : "candleDown"}>
              <line x1={x} x2={x} y1={highY} y2={lowY} />
              <rect x={x - 3} y={bodyY} width="6" height={bodyH} rx="1" />
              <rect className="volumeBar" x={x - 4} y={chartNumber(144 - volumeH)} width="8" height={volumeH} rx="1" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}


function GaugeCard({ label, value, caption, tone }: { label: string; value: number; caption: string; tone: string }) {
  return (
    <div className="gaugeCard">
      <span>{label}</span>
      <div className={`donut ${tone}`} style={{ "--value": `${Math.min(100, Math.max(0, value))}%` } as React.CSSProperties} />
      <strong>{value}<small>/100</small></strong>
      <em>{caption}</em>
    </div>
  );
}

function SignalCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`signalCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Insight({ icon, tone, title, detail }: { icon: React.ReactNode; tone: string; title: string; detail: string }) {
  return (
    <div className={`insight ${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="panelTitle">{icon}{title}</h2>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MosaicStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="mosaicStat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
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


function buyerPressure(token: RadarToken) {
  const total = token.buyers + token.sellers;
  return total ? Math.round((token.buyers / total) * 100) : 0;
}

function chartNumber(value: number) { return Number(value.toFixed(3)); }

function riskTone(level: RiskLevel) {
  if (level === "Low") return "green";
  if (level === "Medium") return "amber";
  return "red";
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
