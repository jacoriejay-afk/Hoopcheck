"use client";

export default function HoopLoading({ label = "Loading HoopCheck..." }: { label?: string }) {
  return (
    <div className="hoop-loading-inline" role="status" aria-live="polite">
      <div className="hoop-loading-mark" aria-hidden="true"><span /><span /><span /></div>
      <div><strong>HOOP<span>CHECK</span></strong><small>{label}</small></div>
    </div>
  );
}
