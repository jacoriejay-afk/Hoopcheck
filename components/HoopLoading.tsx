"use client";

import Logo from "./Logo";

export default function HoopLoading({ label = "Loading HoopCheck…", variant = "screen" }: { label?: string; variant?: "screen" | "inline" }) {
  return (
    <div className={`hoop-loading-inline hc-brand-loader hc-brand-loader--${variant}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="hc-brand-loader__orbit" aria-hidden="true"><i /><i /><i /></span>
      <div className="hoop-loading-copy">
        <Logo variant="full" size={52} />
        <small>{label}</small>
        <span className="hc-brand-loader__track" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}
