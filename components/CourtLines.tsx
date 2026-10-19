"use client";

type CourtLinesProps = {
  variant?: "arc" | "circle" | "full-court";
  className?: string;
};

/** Decorative basketball-court linework. It never captures input or affects layout behavior. */
export default function CourtLines({ variant = "arc", className = "" }: CourtLinesProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg
      className={`hc-court-lines hc-court-lines--${variant} ${className}`.trim()}
      viewBox={variant === "full-court" ? "0 0 240 140" : "0 0 160 90"}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {variant === "arc" && (
        <g {...common}>
          <path d="M-16 90 A96 96 0 0 1 176 90" />
          <path d="M15 90 A65 65 0 0 1 145 90" strokeDasharray="3 5" />
          <path d="M80 0V12" />
        </g>
      )}
      {variant === "circle" && (
        <g {...common}>
          <circle cx="80" cy="45" r="32" />
          <circle cx="80" cy="45" r="22" strokeDasharray="2 5" />
          <path d="M48 45H112M80 13V77" />
          <circle cx="80" cy="45" r="3" fill="currentColor" stroke="none" />
        </g>
      )}
      {variant === "full-court" && (
        <g {...common}>
          <rect x="2" y="2" width="236" height="136" rx="1" />
          <path d="M120 2V138M120 36A34 34 0 0 0 120 104M120 36A34 34 0 0 1 120 104" />
          <circle cx="120" cy="70" r="18" />
          <path d="M2 43H37V97H2M238 43H203V97H238" />
          <path d="M37 43A27 27 0 0 1 37 97M203 43A27 27 0 0 0 203 97" />
          <path d="M2 23A66 66 0 0 1 2 117M238 23A66 66 0 0 0 238 117" />
          <circle cx="19" cy="70" r="3" fill="currentColor" stroke="none" />
          <circle cx="221" cy="70" r="3" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}
