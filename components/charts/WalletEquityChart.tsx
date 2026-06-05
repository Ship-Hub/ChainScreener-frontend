"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type EquityPoint = { month: string; value: number };

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="wpChartTooltip">
      <div className="label">{label}</div>
      <div className="value">${(payload[0].value as number).toLocaleString()}</div>
    </div>
  );
}

export default function WalletEquityChart({ data }: { data: EquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="oklch(0.76 0.19 151)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="oklch(0.76 0.19 151)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.42 0.035 255 / 0.2)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "oklch(0.52 0.032 248)", fontSize: 10 }}
          axisLine={false} tickLine={false} interval={2}
        />
        <YAxis
          tickFormatter={(v: number) => v === 0 ? "$0" : `$${(v / 1000).toFixed(0)}K`}
          domain={["auto", "auto"]}
          tick={{ fill: "oklch(0.52 0.032 248)", fontSize: 10 }}
          axisLine={false} tickLine={false} width={44}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone" dataKey="value"
          stroke="oklch(0.76 0.19 151)" strokeWidth={2}
          fill="url(#equityGrad)" dot={false}
          activeDot={{ r: 4, fill: "oklch(0.76 0.19 151)", stroke: "oklch(0.12 0.018 255)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
