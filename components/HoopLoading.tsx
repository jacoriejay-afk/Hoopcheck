"use client";

export default function HoopLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <span className="hoop-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
