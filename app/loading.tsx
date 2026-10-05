export default function Loading() {
  return (
    <main className="hoop-loading" aria-label="Loading HoopCheck">
      <div className="hoop-loading-inner">
        <div className="hoop-loading-logo">HOOP<span>CHECK</span></div>
        <div className="hoop-loading-ball" aria-hidden="true" />
        <div className="muted">Loading your basketball intelligence...</div>
      </div>
    </main>
  );
}
