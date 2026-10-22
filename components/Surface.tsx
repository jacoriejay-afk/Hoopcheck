import type { FormEventHandler, HTMLAttributes, ReactNode } from "react";

type SurfaceProps = Omit<HTMLAttributes<HTMLElement>, "onSubmit"> & {
  onSubmit?: FormEventHandler<HTMLFormElement>;
  as?: "article" | "section" | "div" | "aside" | "form";
  children: ReactNode;
};

/** Shared semantic surface: theme controls background, border and text as one contract. */
export default function Surface({ as: Tag = "article", className = "", children, ...props }: SurfaceProps) {
  const shared = { ...props, "data-hc-surface": "true" as const, className: `hc-surface ${className}`.trim() };
  if (Tag === "form") return <form {...(shared as HTMLAttributes<HTMLFormElement>)}>{children}</form>;
  return <Tag {...(shared as HTMLAttributes<HTMLElement>)}>{children}</Tag>;
}
