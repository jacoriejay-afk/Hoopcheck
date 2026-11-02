import type { CSSProperties } from "react";

type RouteSkeletonProps = { variant: "home" | "search" | "teams" | "team" | "dashboard" };

const shimmer: CSSProperties = {
  display: "block",
  borderRadius: 9,
  background: "linear-gradient(90deg, var(--hc-skeleton-base, var(--hc-card-border, #e9e9e5)) 25%, var(--hc-skeleton-highlight, var(--hc-card-bg, #f5f5f2)) 50%, var(--hc-skeleton-base, #e9e9e5) 75%)",
  backgroundSize: "200% 100%",
  animation: "hc-feed-shimmer 1.35s ease-in-out infinite",
};

function Bar({ width = "100%", height = 12 }: { width?: string; height?: number }) {
  return <span aria-hidden="true" style={{ ...shimmer, width, height }} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div aria-hidden="true" style={{ display: "grid", gap: 12, minWidth: 0, padding: 16, border: "1px solid var(--hc-card-border, var(--border))", borderRadius: 16, background: "var(--hc-card-bg, var(--surface))" }}>{children}</div>;
}

export default function RouteSkeleton({ variant }: RouteSkeletonProps) {
  const rows = variant === "search" ? 5 : variant === "teams" ? 6 : 3;
  if (variant === "home") {
    return (
      <main className="hc-template-home hc-home-redesign" aria-busy="true" aria-label="Loading Home">
        <section className="hc-template-hero hc-home-hero">
          <div className="hc-template-hero-copy hc-home-hero-copy" style={{ display: "grid", gap: 16, alignContent: "center" }}>
            <Bar width="48%" height={10} />
            <Bar width="94%" height={38} />
            <Bar width="76%" height={38} />
            <Bar width="86%" height={13} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Bar width="150px" height={44} /><Bar width="92px" height={44} /></div>
          </div>
          <div className="hc-template-hero-art hc-home-hero-art"><span aria-hidden="true" style={{ ...shimmer, display: "block", width: "100%", height: "100%", minHeight: 220, borderRadius: 18 }} /></div>
        </section>
        <section className="hc-template-explore hc-home-explore">
          <div className="hc-template-section-title"><Bar width="36%" height={10} /><Bar width="45%" height={25} /></div>
          <div className="hc-template-category-grid hc-home-category-grid" style={{ gap: 12 }}>
            {Array.from({ length: 7 }, (_, i) => <Card key={i}><Bar width="38px" height={38} /><Bar width="78%" /><Bar width="95%" height={9} /></Card>)}
          </div>
        </section>
        <style>{'@media(prefers-reduced-motion:reduce){[aria-busy="true"] span{animation:none!important}}'}</style>
      </main>
    );
  }
  return (
    <main className={variant === "search" ? "search-page" : "page-shell"} aria-busy="true" aria-label="Loading page">
      <div className="page-container" style={{ display: "grid", gap: 16 }}>
        {variant !== "dashboard" && (
          <Card>
            <Bar width="23%" height={9} />
            <Bar width="48%" height={30} />
            <Bar width="82%" />
          </Card>
        )}
        {variant === "home" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
            {Array.from({ length: 7 }, (_, i) => <Card key={i}><Bar width="38px" height={38} /><Bar width="78%" /><Bar width="95%" height={9} /></Card>)}
          </div>
        )}
        {(variant === "search" || variant === "teams" || variant === "team" || variant === "dashboard") && (
          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: rows }, (_, i) => (
              <Card key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ ...shimmer, width: variant === "team" && i === 0 ? 64 : 48, height: variant === "team" && i === 0 ? 64 : 48, borderRadius: "50%", flex: "0 0 auto" }} />
                  <div style={{ display: "grid", gap: 8, flex: 1 }}><Bar width="58%" /><Bar width="82%" height={9} /></div>
                </div>
                <Bar width="100%" height={9} />
                {variant !== "dashboard" && i < 2 && <Bar width="72%" height={9} />}
              </Card>
            ))}
          </div>
        )}
      </div>
      <style>{'@media(prefers-reduced-motion:reduce){[aria-busy="true"] span{animation:none!important}}'}</style>
    </main>
  );
}
