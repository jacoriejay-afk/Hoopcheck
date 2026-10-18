import type { CSSProperties, ReactNode } from "react";

export interface TeamRowProps {
  name: string;
  league: string;
  flag?: string;
  crest?: ReactNode;
  href?: string;
  className?: string;
}

export default function TeamRow({ name, league, flag, crest, href, className = "" }: TeamRowProps) {
  const content = <>
    <span className="hc-team-row__crest" aria-hidden="true">{crest ?? <svg viewBox="0 0 40 44" fill="none"><path d="M20 2 36 8v13c0 9-7 16-16 21C11 37 4 30 4 21V8Z" fill="#F7F7F5" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="20" r="9" stroke="#FF5A1F" strokeWidth="1.5"/><path d="M11 20h18M20 11c-4 4-4 14 0 18M20 11c4 4 4 14 0 18" stroke="#FF5A1F" strokeWidth="1.2"/></svg>}</span>
    <span className="hc-team-row__name">{name}</span>
    {flag && <span className="hc-team-row__flag" aria-label={`Country flag: ${flag}`}>{flag}</span>}
    <span className="hc-team-row__league">{league}</span>
    <span className="hc-team-row__chevron" aria-hidden="true">›</span>
  </>;
  const style = { "--hc-row-hover": "#FFF5F0" } as CSSProperties;
  return href
    ? <a className={`hc-team-row ${className}`.trim()} style={style} href={href}>{content}</a>
    : <div className={`hc-team-row ${className}`.trim()} style={style}>{content}</div>;
}
