"use client";

import { Activity, Radar, Shield, TrendingUp, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const ITEMS = [
  { label: "Radar",   Icon: Radar,      route: "/" },
  { label: "Launch",  Icon: Activity,   route: "/launches" },
  { label: "Markets", Icon: TrendingUp, route: "/top-gainers" },
  { label: "Alpha",   Icon: Zap,        route: "/smart-money" },
  { label: "Risk",    Icon: Shield,     route: "/risk-scanner" },
];

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="mobileBottomNav" aria-label="Navigation">
      {ITEMS.map(({ label, Icon, route }) => {
        const active = pathname === route || (route !== "/" && pathname.startsWith(route));
        return (
          <button
            key={route}
            className={`mobileNavBtn${active ? " active" : ""}`}
            type="button"
            onClick={() => router.push(route)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
