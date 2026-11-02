"use client";

import type { ReactNode } from "react";

/** Shared visual primitives for both HoopCheck feed surfaces. These wrappers own presentation only. */
export function FeedPostCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`dashboard-card hc-feed-ticket hc-feed-shared-card ${className}`.trim()}>{children}</article>;
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
