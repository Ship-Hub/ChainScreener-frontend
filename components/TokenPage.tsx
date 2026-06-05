"use client";

import {
  Activity, AlertTriangle, ArrowLeft, Bell, BookOpen, Check, CircleDollarSign,
  Copy, Crosshair, Database, ExternalLink, Gem, KeyRound, Layers, Lock,
  Radar, RefreshCw, Search, Settings, Shield, Star, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { fetchTokenCandles, fetchTokenSwaps } from "../lib/api";
import type { Candle, ChainKey, TokenDetail, TokenSwap } from "../lib/types";
import { CandlestickChart, type OhlcBar } from "./CandlestickChart";
import { MobileBottomNav } from "./MobileBottomNav";

type Props = { token: TokenDetail };

export function TokenPage({ token }: Props) {
  const [interval, setInterval] = useState("5m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [swaps, setSwaps] = useState<TokenSwap[]>([]);
  const [ohlc, setOhlc] = useState<OhlcBar>(null);
  const [copied, setCopied] = useState(false);
  const [txnOpen, setTxnOpen] = useState(true);
  const [activeTxTab, setActiveTxTab] = useState<"txns" | "traders" | "holders" | "lp" | "bubbles">("txns");
  const [txPanelHeight, setTxPanelHeight] = useState(220);
  const router = useRouter();
  const starKey = `cs:token:starred:${token.chain}:${token.address}`;
  const [starred, setStarred] = useState(false);
  // Load + persist star state
  useEffect(() => {
    try { setStarred(localStorage.getItem(starKey) === "1"); } catch {}
  }, [starKey]);
  const toggleStar = useCallback(() => {
    setStarred(prev => {
      const next = !prev;
      try { next ? localStorage.setItem(starKey, "1") : localStorage.removeItem(starKey); } catch {}
      return next;
    });
  }, [starKey]);
  const [loadingCandles, setLoadingCandles] = useState(true);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const handleOhlc = useCallback((bar: OhlcBar) => setOhlc(bar), []);

  // ── Historical candles — initial load + refresh every 10 s ───────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingCandles(true);
    fetchTokenCandles(token.chain, token.address, interval)
      .then((c) => { if (!cancelled) setCandles(c); })
      .finally(() => { if (!cancelled) setLoadingCandles(false); });
    const id = globalThis.setInterval(() => {
      fetchTokenCandles(token.chain, token.address, interval).then((c) => { if (!cancelled) setCandles(c); });
    }, 10_000);
    return () => { cancelled = true; globalThis.clearInterval(id); };
  }, [token.chain, token.address, interval]);

  // ── Live swaps — poll every 5 s for real-time feel ────────────────────────
  useEffect(() => {
    fetchTokenSwaps(token.chain, token.address, 100).then(setSwaps);
    const id = globalThis.setInterval(() => fetchTokenSwaps(token.chain, token.address, 100).then(setSwaps), 5_000);
    return () => globalThis.clearInterval(id);
  }, [token.chain, token.address]);

  // ── Live partial candle — computed from swaps in the current time bucket ──
  // This gives instant chart updates without waiting for the next aggregation cycle.
  const liveCandle = useMemo((): Candle | null => {
    if (!swaps.length) return null;
    const INTERVAL_MS: Record<string, number> = {
      "1m": 60_000, "5m": 300_000, "15m": 900_000,
      "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
    };
    const bucketMs = INTERVAL_MS[interval] ?? 300_000;
    const now = Date.now();
    const bucketStart = Math.floor(now / bucketMs) * bucketMs;

    // Compute actual swap price from amounts + quote price
    const getSwapPrice = (swap: TokenSwap): number | null => {
      const isToken0 = swap.token0.toLowerCase() === token.address.toLowerCase();
      const tokenRaw = isToken0 ? swap.amount0Raw : swap.amount1Raw;
      const quoteRaw = isToken0 ? swap.amount1Raw : swap.amount0Raw;
      const quotePrice = isToken0 ? swap.token1PriceUsd : swap.token0PriceUsd;
      const quoteDecimals = isToken0 ? swap.token1Decimals : swap.token0Decimals;
      const tokenDecimals = token.decimals;
      const tokenAmt = Math.abs(Number(tokenRaw)) / 10 ** tokenDecimals;
      const quoteAmt = Math.abs(Number(quoteRaw)) / 10 ** quoteDecimals;
      if (tokenAmt <= 0 || quoteAmt <= 0 || quotePrice <= 0) return null;
      return (quoteAmt * quotePrice) / tokenAmt;
    };

    // Include swaps in the current bucket AND the most recent swap as a fallback
    const bucketSwaps = swaps.filter(s => new Date(s.observedAt).getTime() >= bucketStart);
    const source = bucketSwaps.length > 0 ? bucketSwaps : [swaps[0]]; // always show something

    const prices = source.map(getSwapPrice).filter((p): p is number => p !== null && p > 0);
    if (!prices.length) return null;

    // Swaps from API are newest-first; reverse for open=oldest, close=newest
    const chronoPrices = [...prices].reverse();
    const volume = source.reduce((s, sw) => {
      const v = parseSwap(sw, token.address, token.decimals);
      return s + v.usdValue;
    }, 0);

    return {
      time: new Date(bucketStart).toISOString(),
      open: chronoPrices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[0], // most recent
      volume,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swaps, interval, token.address, token.decimals]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartY.current - e.clientY;
      setTxPanelHeight(Math.max(80, Math.min(520, dragStartH.current + delta)));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = txPanelHeight;
    e.preventDefault();
  }, [txPanelHeight]);

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(token.address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [token.address]);

  const explorer = chainExplorer(token.chain);

  const { quoteSymbol, quotePriceUsd, pairLabel, dexLabel, firstSwapAge } = useMemo(() => {
    if (!swaps.length) return { quoteSymbol: "—", quotePriceUsd: 0, pairLabel: `${token.symbol} / —`, dexLabel: "DEX", firstSwapAge: "—" };
    const s = swaps[swaps.length - 1];
    const isToken0 = s.token0.toLowerCase() === token.address.toLowerCase();
    const qSym = isToken0 ? s.token1Symbol : s.token0Symbol;
    const qPrice = isToken0 ? s.token1PriceUsd : s.token0PriceUsd;
    const oldest = swaps.reduce((a, b) => new Date(a.observedAt) < new Date(b.observedAt) ? a : b);
    return { quoteSymbol: qSym, quotePriceUsd: qPrice, pairLabel: `${token.symbol} / ${qSym}`, dexLabel: s.dexName, firstSwapAge: timeAgo(oldest.observedAt) };
  }, [swaps, token]);

  const swapStats = useMemo(() => {
    let buyVol = 0, sellVol = 0;
    const buyers = new Set<string>(), sellers = new Set<string>();
    swaps.forEach((swap) => {
      const v = parseSwap(swap, token.address, token.decimals);
      if (v.isBuy) { buyVol += v.usdValue; if (swap.sender) buyers.add(swap.sender); }
      else { sellVol += v.usdValue; if (swap.sender) sellers.add(swap.sender); }
    });
    return { buyVol, sellVol, buyers: buyers.size, sellers: sellers.size, traders: buyers.size + sellers.size };
  }, [swaps, token]);

  const buyRatio = token.swaps24h > 0 ? token.buys24h / token.swaps24h : 0;
  const buyVolRatio = swapStats.buyVol + swapStats.sellVol > 0 ? swapStats.buyVol / (swapStats.buyVol + swapStats.sellVol) : 0;
  const priceUp = token.priceChange24h >= 0;
  const priceInQuote = quotePriceUsd > 0 ? token.priceUsd / quotePriceUsd : 0;

  // Risk — use real values from API
  const riskScore = token.riskScore;
  const riskLevelLabel = `${token.riskLevel} Risk`;
  const buyerPressure = Math.round(buyRatio * 100);
  const pressureLabel = buyerPressure >= 60 ? "High" : buyerPressure >= 40 ? "Moderate" : "Low";

  // Top traders — derived client-side from swap data
  const topTraders = useMemo(() => {
    const map = new Map<string, { address: string; buyVol: number; sellVol: number; trades: number }>();
    swaps.forEach(swap => {
      if (!swap.sender) return;
      const v = parseSwap(swap, token.address, token.decimals);
      const entry = map.get(swap.sender) ?? { address: swap.sender, buyVol: 0, sellVol: 0, trades: 0 };
      if (v.isBuy) entry.buyVol += v.usdValue; else entry.sellVol += v.usdValue;
      entry.trades++;
      map.set(swap.sender, entry);
    });
    return [...map.values()].sort((a, b) => (b.buyVol + b.sellVol) - (a.buyVol + a.sellVol)).slice(0, 10);
  }, [swaps, token.address, token.decimals]);

  return (
    <div className="tpShell">
      {/* Top Navbar */}
      <header className="topNavbar" style={{ gridColumn: "1 / -1" }}>
        <div className="brandLockup">
          <span className="brandOrb"><Radar size={22} /></span>
          <div><strong>Chain Screener</strong><span>Launch radar</span></div>
        </div>
        <label className="commandSearch">
          <Search size={18} />
          <input placeholder="Search token, wallet, contract, or address..." />
          <kbd>⌘ K</kbd>
        </label>
        <div className="topActions">
          <button className="topButton" type="button"><Bell size={16} /> Alerts</button>
          <button className="topButton" type="button"><Star size={16} /> Watchlist</button>
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <button className="walletButton" type="button" onClick={connected ? openAccountModal : openConnectModal}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "oklch(0.22 0.07 260)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "oklch(0.78 0.14 260)" }}>
                    {connected ? account.displayName.slice(0, 2).toUpperCase() : "0x"}
                  </span>
                  {connected ? account.displayName : "Connect Wallet"}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="tpSidebar">
        <nav className="tpNav">
          <div className="tpNavGroup">
            <a href="/" className="tpNavItem"><Radar size={15} /><span>Radar</span></a>
            <a href="/launches" className="tpNavItem"><Activity size={15} /><span>Launches</span></a>
            <a href="/" className="tpNavItem"><Star size={15} /><span>Watchlist</span></a>
            <a href="/" className="tpNavItem"><Gem size={15} /><span>Opportunities</span></a>
            <a href="/" className="tpNavItem"><Bell size={15} /><span>Alerts</span></a>
          </div>
          <div className="tpNavSection">INTELLIGENCE</div>
          <div className="tpNavGroup">
            <a href="/smart-money" className="tpNavItem"><Zap size={15} /><span>Smart Money</span></a>
            <a href="/" className="tpNavItem"><Wallet size={15} /><span>Wallet Explorer</span></a>
            <a href="/holder-analysis" className="tpNavItem"><Crosshair size={15} /><span>Holder Analysis</span></a>
            <a href="/risk-scanner" className="tpNavItem"><Shield size={15} /><span>Risk Scanner</span></a>
          </div>
          <div className="tpNavSection">TOOLS</div>
          <div className="tpNavGroup">
            <a href="/" className="tpNavItem"><Layers size={15} /><span>DEX Pools</span></a>
            <a href="/" className="tpNavItem"><Lock size={15} /><span>Liquidity Locks</span></a>
            <a href="/" className="tpNavItem"><Database size={15} /><span>Contract Analyzer</span></a>
            <a href="/top-gainers" className="tpNavItem"><TrendingUp size={15} /><span>Top Gainers</span></a>
            <a href="/top-gainers?sort=volume" className="tpNavItem"><CircleDollarSign size={15} /><span>Top Volume</span></a>
          </div>
          <div className="tpNavSection">SETTINGS</div>
          <div className="tpNavGroup">
            <a href="/" className="tpNavItem"><Settings size={15} /><span>Settings</span></a>
            <a href="/" className="tpNavItem"><KeyRound size={15} /><span>API Access</span></a>
            <a href="/" className="tpNavItem"><BookOpen size={15} /><span>Documentation</span></a>
          </div>
        </nav>
        <div className="tpGoProBox">
          <strong><Gem size={14} /> Go Pro</strong>
          <ul>
            <li>Advanced analytics</li>
            <li>Real-time alerts</li>
            <li>Unlimited scans</li>
          </ul>
          <button type="button" className="tpGoProBtn">Upgrade Now →</button>
        </div>
      </aside>

      {/* Main content */}
      <div className="tpMain">
        <div className="tpLeftContent">

        {/* Token header */}
        <div className="tpHeader">
          <div className="tpHeaderTop">
            <button type="button" className="tpBack" onClick={() => router.back()}><ArrowLeft size={14} /> Back</button>
          </div>

          <div className="tpHeaderMid">
            {/* Logo + name + badges */}
            <div className="tpTokenIdent">
              <div className="tpTokenLogo">
                <span>{token.symbol.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="tpTokenMeta">
                <div className="tpTokenNameRow">
                  <span className="tpTokenName">{token.symbol}</span>
                  <button type="button" className="tpIconMini" onClick={copyAddress} title="Copy address">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <span className="tpLiveBadge"><i />LIVE</span>
                  <button type="button" className={`tpStarBtn${starred ? " starred" : ""}`} onClick={toggleStar}>
                    <Star size={15} fill={starred ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="tpTagRow">
                  <span className={`tpChainTag ${token.chain}`}>{chainLabel(token.chain)}</span>
                  <span className="tpDexTag">{dexLabel}</span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="tpPriceCol">
              <div className="tpBigPrice">{formatPriceNode(token.priceUsd)}</div>
              <div className={`tpPriceChange ${priceUp ? "up" : "dn"}`}>
                {priceUp ? "▲" : "▼"} {Math.abs(token.priceChange24h).toFixed(2)}% (24H)
              </div>
            </div>

            {/* Gauge widgets */}
            <div className="tpGauges">
              <GaugeWidget label="Risk Score" value={riskScore} max={100} caption={riskLevelLabel} tone={riskScore < 40 ? "green" : riskScore < 65 ? "amber" : "red"} suffix="/100" />
              <GaugeWidget label="Buyer Pressure" value={buyerPressure} max={100} caption={pressureLabel} tone={buyerPressure >= 55 ? "green" : "amber"} suffix="%" />
              <SmartMoneyWidget label="Smart Money Interest" value="Building" detail={`${token.buys24h} wallets`} />
            </div>
          </div>

          {/* Stat chips */}
          <div className="tpStatChips">
            <StatChip label="Market Cap" value={token.marketCapUsd > 0 ? money(token.marketCapUsd) : "—"} />
            <StatChip label="Volume (24H)" value={money(token.volume24hUsd)} trend="up" />
            <StatChip label="Liquidity" value={token.liquidityUsd > 0 ? money(token.liquidityUsd) : "—"} />
            <StatChip label="Holders" value="—" note="indexer pending" />
            <StatChip label="Age" value={firstSwapAge} />
            <StatChip label="FDV" value={token.totalSupply && token.marketCapUsd > 0 ? money(token.marketCapUsd) : "—"} />
          </div>
        </div>

        {/* Chart + overview row */}
        <div className="tpChartRow">

          {/* Chart + transactions */}
          <div className="tpChartCol">

            {/* OHLC bar */}
            <div className="tpOhlcBar">
              <span className="tpPairLabel">{pairLabel} · {dexLabel} ({chainLabel(token.chain)})</span>
              {ohlc && (
                <span className="tpOhlcValues">
                  <em>O</em><b className={ohlc.open <= ohlc.close ? "up" : "dn"}>{fmtPrice(ohlc.open)}</b>
                  <em>H</em><b className="up">{fmtPrice(ohlc.high)}</b>
                  <em>L</em><b className="dn">{fmtPrice(ohlc.low)}</b>
                  <em>C</em><b className={ohlc.close >= ohlc.open ? "up" : "dn"}>{fmtPrice(ohlc.close)}</b>
                </span>
              )}
            </div>

            {/* Chart */}
            <div className="tpChartArea">
              {loadingCandles && candles.length === 0
                ? <div className="tpChartLoading"><RefreshCw size={18} className="spin" /> Loading chart…</div>
                : <CandlestickChart candles={candles} liveCandle={liveCandle} interval={interval} onIntervalChange={setInterval} onOhlcChange={handleOhlc} />}
            </div>

            {/* Drag handle */}
            <div
              className="tpDragHandle"
              onMouseDown={handleDragStart}
              role="separator"
              aria-label="Resize chart"
            />

            {/* Transactions */}
            <div className="tpTxPanel" style={{ height: txnOpen ? txPanelHeight : 38 }}>
              <div className="tpTxBar">
                <button type="button" className={`tpTxTab ${activeTxTab === "txns" ? "active" : ""}`} onClick={() => setActiveTxTab("txns")}>Transactions</button>
                <button type="button" className={`tpTxTab ${activeTxTab === "traders" ? "active" : ""}`} onClick={() => setActiveTxTab("traders")}>Top Traders</button>
                <button type="button" className={`tpTxTab ${activeTxTab === "holders" ? "active" : ""}`} onClick={() => setActiveTxTab("holders")}>Holders</button>
                <button type="button" className={`tpTxTab ${activeTxTab === "lp" ? "active" : ""}`} onClick={() => setActiveTxTab("lp")}>Liquidity Providers</button>
                <button type="button" className={`tpTxTab ${activeTxTab === "bubbles" ? "active" : ""}`} onClick={() => setActiveTxTab("bubbles")}>Bubble Maps</button>
                <button type="button" className="tpTxToggle" onClick={() => setTxnOpen(!txnOpen)}>{txnOpen ? "▼" : "▲"}</button>
              </div>
              {txnOpen && (
                <div className="tpTxScroll">
                  {/* ── Transactions ── */}
                  {activeTxTab === "txns" && (
                    <table className="tpTxTable">
                      <thead>
                        <tr>
                          <th>TIME</th><th>TYPE</th><th>USD</th><th>{token.symbol}</th>
                          <th>{quoteSymbol}</th><th>PRICE</th><th>TRADER</th><th>TXN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swaps.length === 0 && <tr><td colSpan={8} className="tpTxEmpty">No transactions indexed yet</td></tr>}
                        {swaps.map((swap, i) => {
                          const v = parseSwap(swap, token.address, token.decimals);
                          const badge = getTxBadge(v.usdValue, v.isBuy);
                          return (
                            <tr key={`${swap.txHash}-${i}`} className={v.isBuy ? "tpBuyRow" : "tpSellRow"}>
                              <td className="tpTxTime">{timeAgo(swap.observedAt)}</td>
                              <td><span className={`tpTxType ${v.isBuy ? "buy" : "sell"}`}>{v.isBuy ? "Buy" : "Sell"}</span></td>
                              <td className={v.isBuy ? "up" : "dn"}>{money(v.usdValue)}</td>
                              <td>{fmtAmt(v.tokenAmount)}</td>
                              <td>{fmtAmt(v.quoteAmount)}</td>
                              <td>{formatPricePlain(v.priceUsd)}</td>
                              <td>
                                <div className="tpTraderCell">
                                  {swap.sender
                                    ? <a className="tpTxLink" href={`${explorer}/address/${swap.sender}`} target="_blank" rel="noopener noreferrer">{shortAddr(swap.sender)}</a>
                                    : "—"}
                                  {badge && <span className={`tpWalletBadge ${badge.toLowerCase()}`}>{badge}</span>}
                                </div>
                              </td>
                              <td>
                                <a className="tpTxIconLink" href={`${explorer}/tx/${swap.txHash}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink size={12} />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* ── Top Traders (derived from swap data) ── */}
                  {activeTxTab === "traders" && (
                    <table className="tpTxTable">
                      <thead>
                        <tr><th>#</th><th>TRADER</th><th>BUY VOL</th><th>SELL VOL</th><th>TRADES</th><th>NET</th></tr>
                      </thead>
                      <tbody>
                        {topTraders.length === 0 && <tr><td colSpan={6} className="tpTxEmpty">No swap data yet</td></tr>}
                        {topTraders.map((t, i) => {
                          const net = t.buyVol - t.sellVol;
                          return (
                            <tr key={t.address}>
                              <td className="tpTxTime">{i + 1}</td>
                              <td><a className="tpTxLink" href={`${explorer}/address/${t.address}`} target="_blank" rel="noopener noreferrer">{shortAddr(t.address)}</a></td>
                              <td className="up">{money(t.buyVol)}</td>
                              <td className="dn">{money(t.sellVol)}</td>
                              <td>{t.trades}</td>
                              <td className={net >= 0 ? "up" : "dn"}>{net >= 0 ? "+" : ""}{money(net)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* ── Holders → link to holder analysis ── */}
                  {activeTxTab === "holders" && (
                    <div className="tpTabPlaceholder">
                      <span>Full holder distribution is available in Holder Analysis</span>
                      <a href={`/holder-analysis?chain=${token.chain}&address=${token.address}`} className="tpTabAction">
                        Open Holder Analysis →
                      </a>
                    </div>
                  )}

                  {/* ── Liquidity Providers — Coming Soon ── */}
                  {activeTxTab === "lp" && (
                    <div className="tpTabPlaceholder">
                      <span>🚧 Liquidity provider tracking coming soon</span>
                    </div>
                  )}

                  {/* ── Bubble Maps — external link ── */}
                  {activeTxTab === "bubbles" && (
                    <div className="tpTabPlaceholder">
                      <span>Visualise wallet clustering for this token</span>
                      <a
                        href={`https://app.bubblemaps.io/${token.chain}/token/${token.address}`}
                        target="_blank" rel="noopener noreferrer"
                        className="tpTabAction"
                      >
                        Open on Bubblemaps ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>{/* end tpChartRow */}
        </div>{/* end tpLeftContent */}

        {/* Right: Token Overview panel — full-height sidebar */}
        <aside className="tpOverviewPanel">
            <div className="tpOverviewTitle">
              TOKEN OVERVIEW
              <a href={`${explorer}/address/${token.address}`} target="_blank" rel="noopener noreferrer" className="tpOverviewLink"><ExternalLink size={12} /></a>
            </div>

            <div className="tpOverviewRows">
              <OverviewRow label="Contract">
                <a href={`${explorer}/address/${token.address}`} target="_blank" rel="noopener noreferrer" className="tpAddrLink">{shortAddr(token.address)}</a>
                <button type="button" className="tpIconMini" onClick={copyAddress}>{copied ? <Check size={11} /> : <Copy size={11} />}</button>
              </OverviewRow>
              <OverviewRow label="Token Decimals"><span>{token.decimals}</span></OverviewRow>
              <OverviewRow label="Total Supply">
                <span className="tpSupply">{token.totalSupply ? fmtSupply(token.totalSupply, token.decimals, token.symbol) : "—"}</span>
              </OverviewRow>
              <OverviewRow label="Circulating Supply">
                <span className="tpSupply tpMuted">—</span>
              </OverviewRow>
              <OverviewRow label="Launch Source"><span className="tpMuted">{token.launchSource}</span></OverviewRow>
              <OverviewRow label="First Swap"><span className="tpMuted">{firstSwapAge}</span></OverviewRow>
              <OverviewRow label="Chain">
                <span className={`tpChainTag sm ${token.chain}`}>{chainLabel(token.chain)}</span>
              </OverviewRow>
            </div>

            <div className="tpCategoryTags">
              <span className="tpCatTag">DeFi</span>
              <span className="tpCatTag">On-chain</span>
              <span className={`tpCatTag chain-${token.chain}`}>{chainLabel(token.chain)}</span>
            </div>

            <div className="tpOverviewDivider" />

            {/* Liquidity / FDV / Holders */}
            <div className="tpMetric3Row">
              <div className="tpMetric3Cell">
                <span>Liquidity &amp; Pool</span>
                <strong>{token.liquidityUsd > 0 ? money(token.liquidityUsd) : "—"}</strong>
                <small className="tpMuted">Liquidity</small>
              </div>
              <div className="tpMetric3Cell">
                <span>FDV</span>
                <strong>{token.marketCapUsd > 0 ? money(token.marketCapUsd) : "—"}</strong>
              </div>
              <div className="tpMetric3Cell">
                <span>Holders</span>
                <strong>—</strong>
              </div>
            </div>

            <div className="tpOverviewDivider" />

            {/* Volume + Txns with sparklines */}
            <div className="tpSparkRow">
              <div className="tpSparkCell">
                <span>Volume (24H)</span>
                <strong>{money(token.volume24hUsd)}</strong>
                <em className={priceUp ? "up" : "dn"}>{priceUp ? "+" : ""}{token.priceChange24h.toFixed(2)}%</em>
                <MiniSparkline tone={priceUp ? "green" : "red"} />
              </div>
              <div className="tpSparkCell">
                <span>Transactions (24H)</span>
                <strong>{token.swaps24h}</strong>
                <em className="up">Live</em>
                <MiniSparkline tone="cyan" />
              </div>
            </div>

            <div className="tpOverviewDivider" />

            {/* Buys / Sells */}
            <div className="tpBuySellBlock">
              <div className="tpBuySellRow">
                <div><span>Buys</span><strong className="up">{token.buys24h}</strong></div>
                <div className="tpBuySellPct up">{Math.round(buyRatio * 100)}%</div>
                <div className="tpBuySellPct dn">{Math.round((1 - buyRatio) * 100)}%</div>
                <div><span>Sells</span><strong className="dn">{token.sells24h}</strong></div>
              </div>
              <div className="tpBar">
                <div className="tpBarBuy" style={{ width: `${(buyRatio * 100).toFixed(1)}%` }} />
                <div className="tpBarSell" style={{ width: `${((1 - buyRatio) * 100).toFixed(1)}%` }} />
              </div>
              <div className="tpVolRow">
                <div><span>Buy Volume</span><strong className="up">{money(swapStats.buyVol)}</strong></div>
                <div><span>Sell Volume</span><strong className="dn">{money(swapStats.sellVol)}</strong></div>
              </div>
            </div>

            <div className="tpOverviewDivider" />

            {/* Lifecycle / Risk / Signal */}
            <div className="tpSignalRow">
              <div className="tpSignalCell">
                <span>Lifecycle State</span>
                <div className={`tpLifecycle ${token.lifecycle}`}>
                  <i />{token.lifecycle.toUpperCase()}
                </div>
                <small>Full Tracking</small>
              </div>
              <div className="tpSignalCell">
                <span>Risk Level</span>
                <strong className={token.riskLevel === "Low" ? "up" : token.riskLevel === "Medium" ? "" : "dn"}>
                  {riskLevelLabel}
                </strong>
              </div>
              <div className="tpSignalCell">
                <span>Signal Strength</span>
                <SignalBars value={buyerPressure >= 60 ? 4 : buyerPressure >= 40 ? 3 : 2} />
              </div>
            </div>

            <div className="tpOverviewDivider" />

            <button type="button" className="tpTrackBtn" onClick={toggleStar}>
              <Star size={15} fill={starred ? "currentColor" : "none"} />
              {starred ? "Tracking ✓" : "Track This Token"}
            </button>
          </aside>
      </div>
      <MobileBottomNav />
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function GaugeWidget({ label, value, max, caption, tone, suffix }: { label: string; value: number; max: number; caption: string; tone: string; suffix: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = 22; const circ = 2 * Math.PI * r;
  const colors = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", cyan: "#22d3ee" };
  const color = colors[tone as keyof typeof colors] ?? "#22c55e";
  return (
    <div className="tpGaugeWidget">
      <span className="tpGaugeLabel">{label}</span>
      <div className="tpGaugeBody">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="#1e2535" strokeWidth="4" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${(pct / 100) * circ} ${circ}`}
            strokeLinecap="round" transform="rotate(-90 28 28)" />
        </svg>
        <div className="tpGaugeCenter">
          <strong style={{ color }}>{value}{suffix}</strong>
        </div>
      </div>
      <span className="tpGaugeCaption" style={{ color }}>{caption}</span>
    </div>
  );
}

function SmartMoneyWidget({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="tpGaugeWidget">
      <span className="tpGaugeLabel">{label}</span>
      <div className="tpSmartBody">
        <strong className="up">{value}</strong>
        <MiniSparkline tone="green" />
      </div>
      <span className="tpGaugeCaption up">{detail}</span>
    </div>
  );
}

function MiniSparkline({ tone }: { tone: string }) {
  const colors = { green: "#22c55e", red: "#ef4444", cyan: "#22d3ee", amber: "#f59e0b" };
  const c = colors[tone as keyof typeof colors] ?? "#22c55e";
  return (
    <svg className="tpSparkline" viewBox="0 0 80 28" aria-hidden="true">
      <polyline points="2,22 12,20 20,14 30,18 40,10 50,13 60,7 70,11 78,4" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalBars({ value }: { value: number }) {
  return (
    <div className="tpSignalBars">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`tpBar${i <= value ? " lit" : ""}`} style={{ height: `${i * 5 + 4}px` }} />
      ))}
    </div>
  );
}

function StatChip({ label, value, trend, note }: { label: string; value: string; trend?: "up" | "down"; note?: string }) {
  return (
    <div className="tpStatChip" title={note}>
      <span className="tpStatLabel">{label}</span>
      <span className="tpStatVal">
        {value}
        {trend && <em className={trend === "up" ? "up" : "dn"}>{trend === "up" ? " ↑" : " ↓"}</em>}
        {note && value === "—" && <em className="tpMuted" style={{ fontSize: 9, marginLeft: 3 }}>?</em>}
      </span>
    </div>
  );
}

function OverviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tpOvRow">
      <span className="tpOvLabel">{label}</span>
      <span className="tpOvVal">{children}</span>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────── */

function parseSwap(swap: TokenSwap, addr: string, decimals: number) {
  const isToken0 = swap.token0.toLowerCase() === addr.toLowerCase();
  const tokenRaw = isToken0 ? swap.amount0Raw : swap.amount1Raw;
  const quoteRaw = isToken0 ? swap.amount1Raw : swap.amount0Raw;
  const quotePriceUsd = isToken0 ? swap.token1PriceUsd : swap.token0PriceUsd;
  const quoteDecimals = isToken0 ? swap.token1Decimals : swap.token0Decimals;
  const tokenAmount = Math.abs(Number(tokenRaw)) / 10 ** decimals;
  const quoteAmount = Math.abs(Number(quoteRaw)) / 10 ** quoteDecimals;
  const usdValue = quoteAmount * (quotePriceUsd || 0);
  const priceUsd = tokenAmount > 0 && usdValue > 0 ? usdValue / tokenAmount : 0;
  return { isBuy: Number(tokenRaw) < 0, tokenAmount, quoteAmount, usdValue, priceUsd };
}

function getTxBadge(usdValue: number, isBuy: boolean): string | null {
  if (usdValue >= 50_000) return "Whale";
  if (usdValue >= 10_000) return "Smart";
  return null;
}

function chainExplorer(chain: ChainKey) {
  if (chain === "base") return "https://basescan.org";
  if (chain === "eth") return "https://etherscan.io";
  return "https://bscscan.com";
}

function chainLabel(chain: ChainKey) {
  if (chain === "base") return "Base";
  if (chain === "eth") return "Ethereum";
  return "BSC";
}

function shortAddr(addr: string) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ""; }

function fmtPrice(p: number): string {
  if (!p) return "$0";
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.001) return `$${p.toFixed(6)}`;
  const s = p.toFixed(20); const m = s.match(/^0\.(0*)(\d{1,6})/);
  return m ? `$0.0${m[1].length}${m[2]}` : `$${p.toExponential(3)}`;
}

function formatPricePlain(p: number): string { return fmtPrice(p); }

function formatPriceNode(p: number): React.ReactNode {
  if (!p) return "$0";
  if (p >= 0.001) return fmtPrice(p);
  const s = p.toFixed(20); const m = s.match(/^0\.(0*)(\d{1,6})/);
  if (!m) return fmtPrice(p);
  return <span className="tpSubPrice">$0.0<sub>{m[1].length}</sub>{m[2]}</span>;
}

function money(v: number) {
  if (!v) return "$0";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtAmt(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function fmtSupply(totalSupply: string, decimals: number, symbol: string) {
  try {
    const n = Number(BigInt(totalSupply)) / 10 ** decimals;
    if (n >= 1e9) return `${(n / 1e9).toFixed(0)}B ${symbol}`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M ${symbol}`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K ${symbol}`;
    return `${n.toFixed(0)} ${symbol}`;
  } catch { return "—"; }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
