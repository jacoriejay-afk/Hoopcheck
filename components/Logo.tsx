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
        <path d="M50 5 88 27v46L50 95 12 73V27Z" strokeWidth="5.2" />
        <circle cx="49" cy="49" r="25" strokeWidth="3.4" />
        <path d="M24 49h50M49 24c-10 9-10 41 0 50M49 24c10 9 10 41 0 50M31 31c13 8 23 26 36 36M67 31C54 39 44 57 31 67" strokeWidth="2.8" />
        <path
          className="hc-logo__check"
          d="m48 59 13 11 32-40"
          stroke="#FF5A1F"
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
