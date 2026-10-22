import type { HTMLAttributes, ReactNode } from "react";

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div" | "aside" | "form";
  children: ReactNode;
};

/** Shared semantic surface: theme controls background, border and text as one contract. */
export default function Surface({ as: Tag = "article", className = "", children, ...props }: SurfaceProps) {
  return <Tag {...props} data-hc-surface="true" className={`hc-surface ${className}`.trim()}>{children}</Tag>;
}
