"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DistributionSlice = { name: string; pct: number; color: string };

function DonutTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DistributionSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="haChartTooltip">
      <div className="haTooltipLabel">{slice.name}</div>
      <div className="haTooltipValue" style={{ color: slice.color }}>{slice.pct.toFixed(1)}%</div>
    </div>
  );
}

// When real top10Pct is available: show "Top 10" vs "Others"
// Fallback (no data): show empty/placeholder
export default function HolderPieChart({ top10Pct }: { top10Pct?: number }) {
  const hasData = top10Pct !== undefined && top10Pct > 0;

  const distribution: DistributionSlice[] = hasData
    ? [
        { name: "Top 10 Holders", pct: Math.min(top10Pct!, 100), color: "oklch(0.62 0.23 285)" },
        { name: "Other Holders",  pct: Math.max(0, 100 - top10Pct!), color: "oklch(0.76 0.19 151)" },
      ]
    : [
        { name: "No data",   pct: 100, color: "oklch(0.28 0.04 255)" },
      ];

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
              paddingAngle={hasData ? 3 : 0}
              dataKey="pct"
              strokeWidth={0}
            >
              {distribution.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            {hasData && <Tooltip content={<DonutTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="haDistLegend">
        {hasData ? (
          distribution.map((slice) => (
            <div className="haDistLegendRow" key={slice.name}>
              <span className="haDistDot" style={{ background: slice.color }} />
              <span className="haDistLabel">{slice.name}</span>
              <span className="haDistPct">{slice.pct.toFixed(1)}%</span>
            </div>
          ))
        ) : (
          <div style={{ color: "var(--faint)", fontSize: 12, textAlign: "center", padding: "4px 0" }}>
            Holder snapshot not yet available
          </div>
        )}
      </div>

      {hasData && (
        <div className="haConcentrationWarning">
          <span>⚠</span> Top 10 holders control {top10Pct!.toFixed(1)}% of supply
        </div>
      )}
    </>
  );
}
