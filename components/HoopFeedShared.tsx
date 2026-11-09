"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { Card } from "./LayoutSystem";

/** Shared visual primitives for both HoopCheck feed surfaces. These wrappers own presentation only. */
export function FeedPostCard({ children, className = "", ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return <Card {...props} className={`dashboard-card hc-feed-ticket hc-feed-shared-card ${className}`.trim()}>{children}</Card>;
}

export function FeedAuthorRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hc-feed-post-author hc-feed-shared-author ${className}`.trim()}>{children}</div>;
}

export function FeedMediaArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <div className={`hc-feed-media-area ${className}`.trim()}>{children}</div>;
}

export function FeedActionRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hc-feed-post-actions hc-feed-shared-actions ${className}`.trim()}>{children}</div>;
}

export function FeedEmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`dashboard-card hc-feed-empty hc-feed-shared-empty ${className}`.trim()}>{children}</section>;
}

export function FeedLoadingSkeleton({ count = 3 }: { count?: number }) {
  return <section className="hc-feed-skeletons" aria-label="Loading posts">
    {Array.from({ length: count }, (_, index) => <article className="dashboard-card hc-feed-skeleton hc-feed-shared-card" key={index}>
      <div className="hc-feed-skeleton__head"><span/><div><i/><i/></div></div>
      <i className="hc-feed-skeleton__line"/>
      <i className="hc-feed-skeleton__line short"/>
      <i className="hc-feed-skeleton__photo"/>
      <div className="hc-feed-skeleton__actions"><i/><i/></div>
    </article>)}
  </section>;
}

export function FeedStoryRing({ expiresAt, now, children }: { expiresAt: string; now: number; children: ReactNode }) {
  const remaining = Math.max(0, Math.min(1, (new Date(expiresAt).getTime() - now) / 86400000));
  return <span className="hc-feed-story-ring" style={{ background: `conic-gradient(var(--hc-orange) ${remaining * 360}deg, var(--hc-border) 0deg)` }}>{children}</span>;
}

export function FeedTimeRemaining({ expiresAt, now }: { expiresAt: string; now: number }) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  if (minutes <= 0) return <>Expired</>;
  if (minutes < 60) return <>{minutes}m left</>;
  return <>{Math.ceil(minutes / 60)}h left</>;
}

export function FeedDiscoveryHeader({ audience }: { audience: "player" | "fan" }) {
  return <section className="hc-feed-discovery" aria-label="HoopFeed discovery">
    <div><span className="hc-feed-live-label">THE BASKETBALL COMMUNITY</span><h2>Beyond the box score.</h2><p>{audience === "fan" ? "Your teams. Your community. Your courtside conversation." : "Real moments from practice, travel, and game day."}</p></div>
    <nav aria-label="Explore basketball"><Link href="/search?type=mens-teams">Men’s teams ↗</Link><Link href="/search?type=womens-teams">Women’s teams ↗</Link><Link href="/membership">Membership & perks ↗</Link></nav>
  </section>;
}
