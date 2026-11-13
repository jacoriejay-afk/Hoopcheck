"use client";
import type { SVGProps } from "react";

type LogoProps = {
  variant?: "icon" | "full";
  className?: string;
  wordmarkClassName?: string;
  title?: string;
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Official wordmark traced from the founder-supplied logo image.
 * Vector outlines, not a substitute font. Shared by desktop and mobile/PWA.
 */
export default function Logo({
  variant = "full",
  className = "",
  wordmarkClassName = "",
  title = "HoopCheck",
  size = 44,
  ...props
}: LogoProps) {
  return (
    <span className={`hc-logo hc-logo--${variant} ${className}`.trim()} aria-label={title} role="img">
      <svg className="hc-logo__icon" viewBox="0 0 100 100" width={size} height={size}
        aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
        strokeLinecap="square" strokeLinejoin="miter" {...props}>
        <path d="M50 5 88 27v35L97 51 78 82 50 96 12 74V27Z" strokeWidth="5.2" />
        <circle cx="49" cy="49" r="25" strokeWidth="3.4" />
        <path d="M25 46c15-13 34-13 49-4M27 32c12 17 26 15 44 5M50 24c-13 19-14 41-3 50M49 24c-4 18-2 39 10 49M26 58c14-15 30-12 47 8" strokeWidth="2.8" />
        <path className="hc-logo__check" d="m47 60 14 11 34-42" stroke="currentColor"
          strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      {variant === "full" && (
        <svg className={`hc-logo__official-wordmark ${wordmarkClassName}`.trim()}
          viewBox="0 0 1180 305" width="190" height="49" aria-hidden="true"
          focusable="false" preserveAspectRatio="xMidYMid meet"
          style={{display:"block",width:"clamp(145px, 16vw, 190px)",height:"auto",maxWidth:"100%",flexShrink:1,overflow:"visible"}}>
          <path d="M1178,18 1172,18 1173,44 1175,44 1176,24 1179,32Z M1150,18 1150,20 1157,21 1157,44 1160,44 1160,21 1167,20 1167,18Z M1034,18 1033,259 1068,259 1069,151 1079,177 1104,259 1141,304 1155,304 1137,243 1101,135 1106,113 1137,18 1100,18 1069,120 1068,18Z M929,18 909,40 909,237 929,259 987,259 1007,237 1007,178 972,177 972,221 944,221 943,56 945,54 972,55 973,97 1006,97 1007,41 987,18Z M796,18 795,259 882,259 882,222 830,221 830,154 877,153 876,116 830,115 830,56 832,54 882,54 882,18Z M767,18 732,18 731,116 701,115 701,18 666,18 666,304 674,304 701,259 702,153 732,154 732,259 767,259Z M561,18 540,41 540,237 560,259 618,259 638,237 638,177 604,177 604,221 577,222 575,220 575,56 577,54 604,55 604,97 638,97 638,40 618,18Z M493,18 414,18 414,304 422,303 449,260 449,172 493,171 513,149 513,40Z M450,54 477,54 479,56 479,132 477,134 449,133 448,62Z M305,18 285,40 285,237 306,259 365,259 385,238 385,40 365,18Z M322,54 348,54 350,56 349,222 320,221 320,56Z M177,18 157,40 157,238 177,259 236,259 256,237 256,40 236,18Z M193,54 220,54 222,56 222,203 220,222 193,222 191,220 191,56Z M128,18 93,18 92,116 61,115 61,18 26,18 26,304 35,303 61,259 60,155 62,153 93,154 93,259 127,259Z" fill="currentColor" fillRule="evenodd" />
        </svg>
      )}
    </span>
  );
}
