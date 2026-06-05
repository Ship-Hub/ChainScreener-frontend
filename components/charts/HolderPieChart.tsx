"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DistributionSlice = { name: string; pct: number; count: number; color: string };

const distribution: DistributionSlice[] = [
  { name: "Whales (>$10K)", pct: 24.3, count: 87,   color: "oklch(0.62 0.23 285)" },
  { name: "Large (>$1K)",   pct: 31.7, count: 342,  color: "oklch(0.78 0.17 210)" },
  { name: "Medium (>$100)", pct: 28.4, count: 622,  color: "oklch(0.76 0.19 151)" },
  { name: "Small (<$100)",  pct: 15.6, count: 1142, color: "oklch(0.83 0.18 83)"  },
];

function DonutTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DistributionSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="haChartTooltip">
      <div className="haTooltipLabel">{slice.name}</div>
      <div className="haTooltipValue" style={{ color: slice.color }}>{slice.pct}%</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
        ~{slice.count.toLocaleString()} wallets
      </div>
    </div>
  );
}

export default function HolderPieChart() {
  return (
    <>
      <div className="haDonutWrap">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
              dataKey="pct"
              strokeWidth={0}
            >
              {distribution.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="haDistLegend">
        {distribution.map((slice) => (
          <div className="haDistLegendRow" key={slice.name}>
            <span className="haDistDot" style={{ background: slice.color }} />
            <span className="haDistLabel">{slice.name}</span>
            <span className="haDistPct">{slice.pct}%</span>
            <span className="haDistCount">~{slice.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="haConcentrationWarning">
        <span>⚠</span> Top 10 holders control 34.2% of supply
      </div>
    </>
  );
}
