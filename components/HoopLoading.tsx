"use client";

import Logo from "./Logo";

export default function HoopLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <div className="hoop-loading-copy"><Logo variant="full" size={38} /><small>{label}</small></div>";

import Logo from "./Logo";

export default function HoopLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <Logo variant="icon" size={42} className="hoop-loading-logo" />
      <div className="hoop-loading-copy"><strong><Logo variant="full" size={26} /></strong><small>{label}</small></div>
    </div>
  );
}
