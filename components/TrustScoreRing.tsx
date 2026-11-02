"use client";

import { useEffect, useRef, useState } from "react";

type TrustScoreRingProps = { score: number | null; dimension: number; stroke: number };

function useReducedMotionPreference() {
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

/** HoopCheck's signature score device: one timeline drives the ring sweep, colour band and count-up. */
export default function TrustScoreRing({ score, dimension, stroke }: TrustScoreRingProps) {
  const reduced = useReducedMotionPreference();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const safeScore = score === null ? 0 : Math.max(0, Math.min(100, score));
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (score === null) {
      setProgress(0);
      setDisplayedScore(0);
      return;
    }
    if (reduced) {
      setProgress(1);
      setDisplayedScore(safeScore);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    setProgress(0);
    setDisplayedScore(0);
    const tick = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / 900);
      const eased = 1 - Math.pow(1 - linear, 3);
      setProgress(eased);
      setDisplayedScore(Math.round(safeScore * eased));
      if (linear < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, score, safeScore, reduced]);

  const bandColor = score === null ? "currentColor" : displayedScore < 40 ? "#E5484D" : displayedScore < 70 ? "#FF8A24" : "#1E9E50";
  const offset = circumference * (1 - progress);

  return (
    <div
      ref={rootRef}
      className="hc-trust-score__dial"
      data-brand-device="trust-score-ring"
      style={{ width: dimension, height: dimension }}
      role="img"
      aria-label={score === null ? "Trust Score unavailable" : `Trust Score ${score} out of 100`}
    >
      <svg viewBox={`0 0 ${dimension} ${dimension}`} width={dimension} height={dimension} aria-hidden="true">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth={stroke} />
        {score !== null && <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={bandColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
        />}
      </svg>
      <strong aria-hidden="true">{score === null ? "—" : displayedScore}</strong>
    </div>
  );
}
