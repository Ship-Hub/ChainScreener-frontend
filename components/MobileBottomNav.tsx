"use client";

import { Activity, Radar, Shield, TrendingUp, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dispatchNavStart } from "./NavigationProgress";

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
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  // Clear loading state once navigation completes (pathname changed)
  useEffect(() => {
    setPendingRoute(null);
  }, [pathname]);

  const navigate = (route: string) => {
    // Already navigating somewhere — ignore taps
    if (pendingRoute) return;
    // Already on this route — no-op
    const isActive = pathname === route || (route !== "/" && pathname.startsWith(route));
    if (isActive) return;

    setPendingRoute(route);
    dispatchNavStart();
    router.push(route);
  };

  return (
    <nav className="mobileBottomNav" aria-label="Navigation">
      {ITEMS.map(({ label, Icon, route }) => {
        const active  = pathname === route || (route !== "/" && pathname.startsWith(route));
        const pending = pendingRoute === route;
        return (
          <button
            key={route}
            className={`mobileNavBtn${active ? " active" : ""}${pending ? " pending" : ""}`}
            type="button"
            onClick={() => navigate(route)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            aria-busy={pending || undefined}
            // Disable all buttons while a navigation is in-flight to prevent double-taps
            disabled={pendingRoute !== null && !active}
          >
            <Icon size={20} strokeWidth={active || pending ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
