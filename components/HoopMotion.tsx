"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function MotionNumber({ value, duration = 900, className, label, onValueChange }: { value: number; duration?: number; className?: string; label?: string; onValueChange?: (value: number) => void }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (reduced || !Number.isFinite(value)) { setShown(value); onValueChange?.(value); return; }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (value - from) * eased);
      setShown(current);
      onValueChange?.(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, value, duration, reduced, onValueChange]);
  return <span ref={ref} className={className} aria-label={label || String(value)}>{Math.round(shown).toLocaleString()}</span>;
}

export function HoopCheckDraw({ size = 26, className = "", label = "Confirmed" }: { size?: number; className?: string; label?: string }) {
  const reduced = useReducedMotion();
  return <span className={`hc-motion-check ${className}`} role="img" aria-label={label} style={{ width: size, height: size }}>
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle className={reduced ? "" : "hc-motion-check__ring"} cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path className={reduced ? "" : "hc-motion-check__path"} d="m6.5 12.2 3.7 3.7 7.6-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>;
}

export function PlayerCardSkeletons({ count = 3 }: { count?: number }) {
  return <div className="hc-motion-skeleton-list" role="status" aria-label="Loading directory">
    {Array.from({ length: Math.max(1, Math.min(8, count)) }, (_, index) => <div className="hc-motion-player-skeleton" key={index}>
      <span className="hc-motion-player-skeleton__avatar" />
      <span className="hc-motion-player-skeleton__body"><i /><i /><i /></span>
      <span className="hc-motion-player-skeleton__action" />
    </div>)}
  </div>;
}

export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown, threshold = 76) {
  const startY = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reduced = useReducedMotion();
  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (window.scrollY <= 0 && !refreshing) startY.current = event.touches[0]?.clientY ?? null;
    else startY.current = null;
  }, [refreshing]);
  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (startY.current === null || refreshing) return;
    const delta = (event.touches[0]?.clientY ?? startY.current) - startY.current;
    if (delta > 0) setDistance(Math.min(threshold, delta * 0.55));
  }, [refreshing, threshold]);
  const onTouchEnd = useCallback(async () => {
    startY.current = null;
    if (distance >= threshold * 0.72 && !refreshing) {
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); setDistance(0); }
    } else setDistance(0);
  }, [distance, onRefresh, refreshing, threshold]);
  return {
    pullToRefreshProps: { onTouchStart, onTouchMove, onTouchEnd },
    pullIndicator: <div className={`hc-motion-pull-indicator${refreshing ? " is-refreshing" : ""}`} style={{ height: distance, transition: reduced ? "none" : undefined }} aria-live="polite"><><span className="hc-motion-basketball" aria-hidden="true" />{refreshing ? "Refreshing…" : distance > 8 ? "Release to refresh" : ""}</></div>,
  };
}

export function MotionSwoosh({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  if (!active || reduced) return null;
  return <span className="hc-motion-swoosh" aria-hidden="true"><i /><i /><i /></span>;
}
