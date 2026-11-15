import type { ReactNode } from "react";
import Surface from "./Surface";

export const profileCovers = [
  { id: "court", label: "Court", color: "#ff790b" },
  { id: "rose", label: "Rose", color: "#ef77af" },
  { id: "violet", label: "Violet", color: "#9d89f5" },
  { id: "ocean", label: "Ocean", color: "#59b8cf" },
] as const;

export function profileCover(value: unknown) {
  return profileCovers.find(cover => cover.id === value)?.id ?? "court";
}

export default function SocialProfileHeader({
  name, handle, avatarUrl, cover = "court", badge, actions, children,
}: {
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  cover?: ReturnType<typeof profileCover>;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "HC";

  return (
    <Surface as="section" className="hc-social-profile" aria-labelledby="hc-social-profile-name" data-profile-cover={cover}>
      <div className="hc-social-cover" aria-hidden="true" />
      <div className="hc-social-profile-body">
        <div className="hc-social-avatar-row">
          <div className="hc-social-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </div>
          {actions && <div className="hc-social-actions">{actions}</div>}
        </div>
        <h1 id="hc-social-profile-name">{name} {badge}</h1>
        {handle && <p className="hc-social-handle">@{handle}</p>}
        {children}
      </div>
    </Surface>
  );
}
