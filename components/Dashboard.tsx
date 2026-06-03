"use client";

import { Activity, ArrowDown, ArrowUp, Bell, CandlestickChart, Filter, Flame, Search, ShieldAlert, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChainKey, TokenSummary } from "../lib/types";

type DashboardProps = {
  initialTokens: TokenSummary[];
  initialTrending: TokenSummary[];
};

const chainOptions: Array<"all" | ChainKey> = ["all", "base", "eth", "bsc"];
const riskOptions = ["all", "Low", "Medium", "High", "Extreme"];

const demoChart = Array.from({ length: 32 }, (_, index) => ({
  t: index,
  price: Number((0.0034 + Math.sin(index / 4) * 0.0004 + index * 0.00005).toFixed(5)),
  volume: Math.round(1200 + Math.random() * 6000),
}));

export function Dashboard({ initialTokens, initialTrending }: DashboardProps) {
  const [chain, setChain] = useState<"all" | ChainKey>("all");
  const [risk, setRisk] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TokenSummary | undefined>(initialTokens[0]);

  const tokens = useMemo(() => {
    return initialTokens
      .filter((token) => chain === "all" || token.chain === chain)
      .filter((token) => risk === "all" || token.riskLevel === risk)
      .filter((token) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return token.symbol.toLowerCase().includes(needle) || token.name.toLowerCase().includes(needle) || token.address.toLowerCase().includes(needle);
      });
  }, [chain, initialTokens, query, risk]);

  const hotCount = tokens.filter((token) => token.lifecycle === "hot").length;
  const averageRisk = tokens.length ? Math.round(tokens.reduce((sum, token) => sum + token.riskScore, 0) / tokens.length) : 0;
  const totalVolume = tokens.reduce((sum, token) => sum + token.volume24hUsd, 0);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">CS</div>
          <div>
            <strong>Chain Screener</strong>
            <span>Launch intelligence</span>
          </div>
        </div>
        <nav className="topnav" aria-label="Primary">
          <button className="navButton active" type="button"><Activity size={16} /> Feed</button>
          <button className="navIcon" type="button" aria-label="Alerts"><Bell size={17} /></button>
        </nav>
      </header>

      <TrendingTicker tokens={initialTrending.length ? initialTrending : initialTokens} onSelect={setSelected} />

      <section className="summaryBand" aria-label="Market summary">
        <Metric label="Hot launches" value={hotCount.toString()} icon={<Flame size={18} />} tone="green" />
        <Metric label="24h volume" value={money(totalVolume)} icon={<CandlestickChart size={18} />} tone="cyan" />
        <Metric label="Average risk" value={`${averageRisk}/100`} icon={<ShieldAlert size={18} />} tone="amber" />
        <Metric label="Smart buys" value={tokens.reduce((sum, token) => sum + token.smartWalletBuys, 0).toString()} icon={<Wallet size={18} />} tone="violet" />
      </section>

      <section className="workbench">
        <aside className="filters" aria-label="Filters">
          <div className="filterTitle"><Filter size={16} /> Filters</div>
          <label className="field">
            <span>Search</span>
            <div className="searchBox">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker, name, address" />
            </div>
          </label>
          <Segmented label="Chain" options={chainOptions} value={chain} onChange={(value) => setChain(value as "all" | ChainKey)} />
          <Segmented label="Risk" options={riskOptions} value={risk} onChange={setRisk} />
          <div className="filterReadout">
            <span>{tokens.length} launches</span>
            <span>{chain.toUpperCase()}</span>
          </div>
        </aside>

        <section className="tableRegion" aria-label="Token launch feed">
          <TokenTable tokens={tokens} selected={selected} onSelect={setSelected} />
        </section>

        <TokenDrawer token={selected} />
      </section>
    </main>
  );
}

function TrendingTicker({ tokens, onSelect }: { tokens: TokenSummary[]; onSelect: (token: TokenSummary) => void }) {
  const tickerTokens = [...tokens, ...tokens];
  return (
    <section className="ticker" aria-label="Trending tokens">
      <div className="tickerTrack">
        {tickerTokens.map((token, index) => (
          <button className="tickerItem" key={`${token.address}-${index}`} type="button" onClick={() => onSelect(token)}>
            <TokenAvatar token={token} />
            <strong>{token.symbol}</strong>
            <span className={token.priceChange24h >= 0 ? "up" : "down"}>{signedPct(token.priceChange24h)}</span>
            <span>{money(token.marketCapUsd)}</span>
            <span className="tickerTip">{token.launchSource} | {token.riskLevel} risk | Score {token.trendingScore}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="segGroup">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button className={value === option ? "selected" : ""} key={option} type="button" onClick={() => onChange(option)}>
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenTable({ tokens, selected, onSelect }: { tokens: TokenSummary[]; selected?: TokenSummary; onSelect: (token: TokenSummary) => void }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Chain</th>
            <th>Source</th>
            <th>Age</th>
            <th>Price</th>
            <th>24h</th>
            <th>MCap</th>
            <th>Liq</th>
            <th>Volume</th>
            <th>Buys/Sells</th>
            <th>Holders</th>
            <th>Risk</th>
            <th>Smart</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr className={selected?.address === token.address ? "rowActive" : ""} key={token.address} onClick={() => onSelect(token)}>
              <td>
                <div className="tokenCell">
                  <TokenAvatar token={token} />
                  <div>
                    <strong>{token.symbol}</strong>
                    <span>{token.name}</span>
                  </div>
                </div>
              </td>
              <td><span className={`chain ${token.chain}`}>{token.chain.toUpperCase()}</span></td>
              <td>{token.launchSource}</td>
              <td>{formatAge(token.ageMinutes)}</td>
              <td>${token.priceUsd.toFixed(token.priceUsd < 0.01 ? 5 : 3)}</td>
              <td className={token.priceChange24h >= 0 ? "up" : "down"}>{signedPct(token.priceChange24h)}</td>
              <td>{money(token.marketCapUsd)}</td>
              <td>{money(token.liquidityUsd)}</td>
              <td>{money(token.volume24hUsd)}</td>
              <td>{token.buys}/{token.sells}</td>
              <td>{compact(token.holders)}</td>
              <td><span className={`risk ${token.riskLevel.toLowerCase()}`}>{token.riskLevel}</span></td>
              <td>{token.smartWalletBuys}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TokenDrawer({ token }: { token?: TokenSummary }) {
  if (!token) {
    return <aside className="drawer empty">Select a token</aside>;
  }

  const riskReasons = [
    `${token.topHolderConcentration}% top holder concentration`,
    token.devWalletActivity === "quiet" ? "Developer wallet quiet" : `Developer wallet: ${token.devWalletActivity}`,
    `${token.uniqueBuyers} unique buyers vs ${token.uniqueSellers} sellers`,
  ];

  return (
    <aside className="drawer">
      <div className="drawerHead">
        <TokenAvatar token={token} />
        <div>
          <strong>{token.symbol}</strong>
          <span>{token.name}</span>
        </div>
      </div>
      <div className="priceLine">
        <strong>${token.priceUsd.toFixed(5)}</strong>
        <span className={token.priceChange1h >= 0 ? "up" : "down"}>
          {token.priceChange1h >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          {signedPct(token.priceChange1h)} 1h
        </span>
      </div>
      <div className="chartBox">
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={demoChart}>
            <defs>
              <linearGradient id="price" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.74 0.17 172)" stopOpacity={0.42} />
                <stop offset="95%" stopColor="oklch(0.74 0.17 172)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={{ background: "oklch(0.18 0.018 235)", border: "1px solid oklch(0.36 0.026 235)", color: "oklch(0.88 0.012 220)" }} />
            <Area dataKey="price" stroke="oklch(0.74 0.17 172)" fill="url(#price)" strokeWidth={2} type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="detailGrid">
        <Detail label="Market cap" value={money(token.marketCapUsd)} />
        <Detail label="Liquidity" value={money(token.liquidityUsd)} />
        <Detail label="Volume 1h" value={money(token.volume1hUsd)} />
        <Detail label="Trending" value={`${token.trendingScore}/100`} />
      </div>
      <section className="riskPanel">
        <div>
          <span>Risk score</span>
          <strong>{token.riskScore}/100</strong>
        </div>
        {riskReasons.map((reason) => <p key={reason}>{reason}</p>)}
      </section>
      <section className="miniFeed">
        <strong>Live activity</strong>
        <p>{token.smartWalletBuys} smart wallet buys detected across active pools.</p>
        <p>{token.newHolders24h} new holders since launch window opened.</p>
      </section>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TokenAvatar({ token }: { token: TokenSummary }) {
  return token.logoUrl ? <img className="avatar" src={token.logoUrl} alt="" /> : <span className="avatar">{token.symbol.slice(0, 1)}</span>;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function compact(value: number) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
