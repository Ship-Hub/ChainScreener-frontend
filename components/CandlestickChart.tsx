"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "../lib/types";

export type OhlcBar = { open: number; high: number; low: number; close: number; time: number } | null;

type Props = {
  candles: Candle[];
  liveCandle?: Candle | null; // current partial candle derived from live swap feed
  interval: string;
  onIntervalChange: (interval: string) => void;
  onOhlcChange?: (bar: OhlcBar) => void;
};

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChartData(candles: Candle[], liveCandle?: Candle | null): { mapped: any[]; volMapped: any[] } {
  const seen = new Set<number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volMapped: any[] = [];

  const all = liveCandle ? [...candles, liveCandle] : candles;
  all
    .slice()
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .forEach((c) => {
      const t = Math.floor(new Date(c.time).getTime() / 1000);
      if (seen.has(t)) return;
      seen.add(t);
      mapped.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
      volMapped.push({
        time: t,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
      });
    });

  return { mapped, volMapped };
}

export function CandlestickChart({ candles, liveCandle, interval, onIntervalChange, onOhlcChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<any>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const chartCreatedRef = useRef(false);

  // ── Chart instance creation (one-time, on mount) ────────
  useEffect(() => {
    if (chartCreatedRef.current) return;
    if (!containerRef.current) return;
    chartCreatedRef.current = true;

    if (candles.length === 0 && !liveCandle) {
      setIsEmpty(true);
      onOhlcChange?.(null);
      return;
    }
    setIsEmpty(false);

    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then((lc) => {
      if (!containerRef.current) return;

      const el = containerRef.current;
      const chart = lc.createChart(el, {
        width: el.clientWidth,
        height: el.clientHeight || 300,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "rgba(148,163,184,0.85)",
          fontSize: 11,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(51,58,82,0.55)" },
          horzLines: { color: "rgba(51,58,82,0.55)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(100,130,200,0.5)", width: 1, style: lc.LineStyle.Dashed, labelBackgroundColor: "oklch(0.22 0.055 235)" },
          horzLine: { color: "rgba(100,130,200,0.5)", width: 1, style: lc.LineStyle.Dashed, labelBackgroundColor: "oklch(0.22 0.055 235)" },
        },
        rightPriceScale: { borderColor: "rgba(51,58,82,0.7)", scaleMargins: { top: 0.08, bottom: 0.22 }, autoScale: true },
        timeScale: { borderColor: "rgba(51,58,82,0.7)", timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8, minBarSpacing: 2 },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      });
      chartRef.current = chart;

      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
        borderVisible: true, wickVisible: true,
      });
      seriesRef.current = candleSeries;

      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "volume",
        lastValueVisible: false, priceLineVisible: false,
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volSeriesRef.current = volumeSeries;

      chart.subscribeCrosshairMove((param: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = param as any;
        if (!p?.time || !p?.seriesData) return;
        const bar = p.seriesData.get(candleSeries);
        if (bar) onOhlcChange?.({ ...bar, time: p.time });
      });

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chartRef.current) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) chartRef.current.applyOptions({ width, height });
      });
      ro.observe(el);

      cleanup = () => {
        ro.disconnect();
        try { chart.remove(); } catch { /* ignore */ }
        chartRef.current = null;
        seriesRef.current = null;
        volSeriesRef.current = null;
        chartCreatedRef.current = false;
      };
    });

    return () => cleanup?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // ── Set data whenever candles/liveCandle changes (no full re-creation) ─────
  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current) return;
    if (candles.length === 0 && !liveCandle) {
      setIsEmpty(true);
      return;
    }
    setIsEmpty(false);

    const { mapped, volMapped } = buildChartData(candles, liveCandle);
    try {
      seriesRef.current.setData(mapped);
      volSeriesRef.current.setData(volMapped);
      chartRef.current?.timeScale().fitContent();

      const last = mapped[mapped.length - 1];
      if (last) onOhlcChange?.({ open: last.open, high: last.high, low: last.low, close: last.close, time: last.time });
    } catch { /* chart not ready yet */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, liveCandle, onOhlcChange]);

  // ── Live candle update — no full re-render, just series.update() ──────────
  useEffect(() => {
    if (!liveCandle || !seriesRef.current || !volSeriesRef.current) return;
    const t = Math.floor(new Date(liveCandle.time).getTime() / 1000);
    try {
      seriesRef.current.update({ time: t, open: liveCandle.open, high: liveCandle.high, low: liveCandle.low, close: liveCandle.close });
      volSeriesRef.current.update({ time: t, value: liveCandle.volume, color: liveCandle.close >= liveCandle.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)" });
    } catch { /* chart may not be ready yet */ }
  }, [liveCandle]);

  return (
    <div className="dsChartWrap">
      <div className="dsIntervalBar">
        {INTERVALS.map((iv) => (
          <button key={iv} type="button" className={`dsIvBtn${interval === iv ? " active" : ""}`} onClick={() => onIntervalChange(iv)}>
            {iv}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="dsChartCanvas">
        {isEmpty && <div className="dsChartEmpty">No candle data yet — indexing in progress</div>}
      </div>
    </div>
  );
}
