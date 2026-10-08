"use client";

export default function HoopLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <div className="hoop-loading-globe" aria-hidden="true">
        <span className="globe-line globe-line-a" />
        <span className="globe-line globe-line-b" />
        <span className="globe-line globe-line-c" />
        <span className="globe-line globe-line-d" />
      </div>
      <div className="hoop-loading-copy">
        <strong>HOOP<span>CHECK</span></strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
