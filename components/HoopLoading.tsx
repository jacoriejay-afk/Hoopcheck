"use client";

import Logo from "./Logo";

export default function HoopLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <div className="hoop-loading-copy">
        <Logo variant="full" size={38} />
        <small>{label}</small>
      </div>
    </div>
  );
}
