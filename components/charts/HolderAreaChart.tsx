"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

type GrowthPoint = { date: string; holders: number };
type TimeRange = "7D" | "30D" | "90D";

const growthData30D: GrowthPoint[] = [
  { date: "May 5",  holders: 812  }, { date: "May 7",  holders: 878  },
  { date: "May 9",  holders: 923  }, { date: "May 11", holders: 987  },
  { date: "May 13", holders: 1042 }, { date: "May 15", holders: 1098 },
  { date: "May 17", holders: 1165 }, { date: "May 19", holders: 1210 },
  { date: "May 21", holders: 1291 }, { date: "May 23", holders: 1358 },
  { date: "May 25", holders: 1427 }, { date: "May 27", holders: 1519 },
  { date: "May 29", holders: 1634 }, { date: "May 31", holders: 1782 },
  { date: "Jun 1",  holders: 1892 }, { date: "Jun 2",  holders: 2041 },
  { date: "Jun 3",  holders: 2193 },
];
const growthData7D: GrowthPoint[] = growthData30D.slice(-7);
const growthData90D: GrowthPoint[] = [
  { date: "Mar 6",  holders: 182  }, { date: "Mar 14", holders: 241  },
  { date: "Mar 22", holders: 318  }, { date: "Mar 30", holders: 402  },
  { date: "Apr 7",  holders: 498  }, { date: "Apr 15", holders: 591  },
  { date: "Apr 23", holders: 672  }, { date: "May 1",  holders: 748  },
  { date: "May 9",  holders: 923  }, { date: "May 17", holders: 1165 },
  { date: "May 25", holders: 1427 }, { date: "Jun 3",  holders: 2193 },
];

function AreaTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="haChartTooltip">
      <div className="haTooltipLabel">{label}</div>
      <div className="haTooltipValue" style={{ color: "var(--green)" }}>
        {payload[0].value.toLocaleString()} holders
      </div>
    </div>
  );
}

export default function HolderAreaChart() {
  const [range, setRange] = useState<TimeRange>("30D");
  const data = range === "7D" ? growthData7D : range === "90D" ? growthData90D : growthData30D;

  return (
    <div className="haChartSection">
      <div className="haChartHeader">
        <h2 className="haChartTitle">
          <TrendingUp size={14} /> Holder Count Over Time
        </h2>
        <div className="haTimeGroup">
          {(["7D", "30D", "90D"] as TimeRange[]).map((r) => (
            <button
              key={r}
              className={`haTimeBtn ${range === r ? "active" : ""}`}
              type="button"
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="haChartWrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="holderGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="oklch(0.76 0.19 151)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="oklch(0.76 0.19 151)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.42 0.035 255 / 0.2)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "oklch(0.52 0.032 248)", fontSize: 10 }}
              axisLine={false} tickLine={false} dy={8}
            />
            <YAxis
              domain={[0, 2500]}
              tick={{ fill: "oklch(0.52 0.032 248)", fontSize: 10 }}
              axisLine={false} tickLine={false} dx={-4}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v)}
            />
            <Tooltip content={<AreaTooltip />} />
            <Area
              type="monotone" dataKey="holders"
              stroke="oklch(0.76 0.19 151)" strokeWidth={2}
              fill="url(#holderGrad)" dot={false}
              activeDot={{ r: 4, fill: "oklch(0.76 0.19 151)", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
