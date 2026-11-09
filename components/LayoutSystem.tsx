import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type BaseProps = { children: ReactNode; className?: string };

/** Global content frame. Page content remains responsible for its own semantics. */
export function PageShell({ children, className = "", id }: BaseProps & { id?: string }) {
  return <div id={id} tabIndex={id ? -1 : undefined} className={`hc-global-page-shell ${className}`.trim()}>{children}</div>;
}

export function Card({ children, className = "", ...props }: BaseProps & HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`hc-layout-card ${className}`.trim()}>{children}</section>;
}

export function GroupCard({ title, children, className = "" }: BaseProps & { title?: string }) {
  return <section className={`hc-layout-group ${className}`.trim()}>{title ? <h3 className="hc-layout-group-title">{title}</h3> : null}<div className="hc-layout-group-body hc-settings-list">{children}</div></section>;
}

export function Row({ label, value, href, icon, onClick, className = "" }: { label: ReactNode; value?: ReactNode; href?: string; icon?: ReactNode; onClick?: () => void; className?: string }) {
  const content = <>{icon ? <span className="hc-layout-row-icon">{icon}</span> : null}<span className="hc-layout-row-label">{label}</span>{value !== undefined ? <span className="hc-layout-row-value">{value}</span> : null}{href || onClick ? <span className="hc-layout-row-chevron" aria-hidden="true">›</span> : null}</>;
  if (href) return <Link href={href} className={`hc-layout-row ${className}`.trim()}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`hc-layout-row ${className}`.trim()}>{content}</button>;
  return <div className={`hc-layout-row ${className}`.trim()}>{content}</div>;
}

export function SectionHeader({ title, eyebrow, className = "" }: { title: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return <header className={`hc-layout-section-header ${className}`.trim()}>{eyebrow ? <p>{eyebrow}</p> : null}<h2>{title}</h2></header>;
}
