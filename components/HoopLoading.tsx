"use client";

import Logo from "./Logo";

export default function HoopLoading({ label = "Loading HoopCheck…", variant = "screen" }: { label?: string; variant?: "screen" | "inline" }) {
  return (
    <div className={`hoop-loading-inline hc-brand-loader hc-brand-loader--${variant}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="hc-brand-loader__orbit" aria-hidden="true"><i /><i /><i /><svg className="hc-owner-court" viewBox="0 0 100 64" fill="none" aria-hidden="true"><rect x="3" y="3" width="94" height="58" rx="2" /><path d="M50 3v58M3 18h18v28H3M97 18H79v28h18" /><circle cx="50" cy="32" r="10" /></svg></span>
      <div className="hoop-loading-copy">
        <Logo variant="full" size={52} />
        <small>{label}</small>
        <span className="hc-brand-loader__track" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}
