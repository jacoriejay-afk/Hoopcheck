"use client";

export default function HoopLoading({ label = "Loading HoopCheck..." }: { label?: string }) {
  return (
    <div className="hoop-loading-screen" role="status" aria-live="polite">
      <div className="hoop-loading-globe" aria-hidden="true">
        <span className="globe-ring globe-ring-a" />
        <span className="globe-ring globe-ring-b" />
        <span className="globe-lat globe-lat-a" />
        <span className="globe-lat globe-lat-b" />
      </div>
      <div className="hoop-loading-wordmark">HOOPCHECK</div>
      <div className="hoop-loading-label">{label}</div>
    </div>
  );
}
