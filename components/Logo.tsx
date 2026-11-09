"use client";

import type { SVGProps } from "react";

type LogoProps = {
  variant?: "icon" | "full";
  className?: string;
  wordmarkClassName?: string;
  title?: string;
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "children">;

export default function Logo({
  variant = "full",
  className = "",
  wordmarkClassName = "",
  title = "HoopCheck",
  size = 44,
  ...props
}: LogoProps) {
  return (
    <span
      className={`hc-logo hc-logo--${variant} ${className}`.trim()}
      aria-label={title}
      role="img"
    >
      <svg
        className="hc-logo__icon"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        {...props}
      >
        <path d="M50 5 88 27v35L97 51 78 82 50 96 12 74V27Z" strokeWidth="5.2" />
        <circle cx="49" cy="49" r="25" strokeWidth="3.4" />
        <path d="M25 46c15-13 34-13 49-4M27 32c12 17 26 15 44 5M50 24c-13 19-14 41-3 50M49 24c-4 18-2 39 10 49M26 58c14-15 30-12 47 8" strokeWidth="2.8" />
        <path
          className="hc-logo__check"
          d="m47 60 14 11 34-42"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      {variant === "full" && (
        <span className={`hc-logo__wordmark ${wordmarkClassName}`.trim()}>
          <span className="hc-logo__hoop">HOOP</span>
          <span className="hc-logo__check-word">CHECK</span>
        </span>
      )}
    </span>
  );
}
