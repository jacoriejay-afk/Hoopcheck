import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HoopIcon, type HoopIconName } from "./HoopCheckUI";

export type CategoryTileKind = "teams" | "womens" | "coaches" | "leagues" | "players" | "reviews" | "alerts";

const categoryColors: Record<CategoryTileKind, string> = {
  teams: "var(--hc-category-teams)",
  womens: "var(--hc-category-womens)",
  coaches: "var(--hc-category-coaches)",
  leagues: "var(--hc-category-leagues)",
  players: "var(--hc-category-players)",
  reviews: "var(--hc-category-reviews)",
  alerts: "var(--hc-category-alerts)",
};

function CategoryIcon({ kind }: { kind: CategoryTileKind }) {
  const iconByCategory: Record<CategoryTileKind, HoopIconName> = {
    teams: "basketball",
    womens: "users",
    coaches: "whistle",
    leagues: "trophy",
    players: "user",
    reviews: "star",
    alerts: "shield-check",
  };
  return <HoopIcon name={iconByCategory[kind]} size={22} strokeWidth={1.7} />;
}
