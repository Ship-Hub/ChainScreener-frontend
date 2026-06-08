"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin cyan progress bar fixed to the top of the viewport.
 * Starts animating when `dispatchNavStart()` is called, completes
 * when the pathname changes (navigation finished).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const prevPath = useRef(pathname);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for nav-start events dispatched by any component's navigate call
  useEffect(() => {
    const onStart = () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      setVisible(true);
      setWidth(3);
      startRef.current = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startRef.current;
        // Eases toward 80% asymptotically — never hits 100 until pathname changes
        const next = 3 + 77 * (1 - Math.exp(-elapsed / 2000));
        setWidth(next);
        if (next < 80) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("cs:nav-start", onStart);
    return () => {
      window.removeEventListener("cs:nav-start", onStart);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  // Complete bar when the route finishes loading
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setWidth(100);

    doneTimer.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        height: "2px",
        width: `${width}%`,
        background: "var(--cyan)",
        boxShadow: "0 0 10px oklch(0.78 0.17 210 / 0.9), 0 0 3px oklch(0.78 0.17 210)",
        transition:
          width >= 100
            ? "width 200ms ease-out"
            : width <= 3
              ? "none"
              : "width 300ms linear",
        pointerEvents: "none",
        borderRadius: "0 1px 1px 0",
      }}
    />
  );
}

/**
 * Dispatch this before any router.push() call.
 * Tells NavigationProgress to start animating immediately.
 * Safe to call during SSR (no-op if window is undefined).
 */
export function dispatchNavStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cs:nav-start"));
  }
}
