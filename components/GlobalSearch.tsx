"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SearchBar from "./SearchBar";

export default function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") || "");

  function submit(query: string) {
    const normalized = query.trim();
    if (normalized) router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  return (
    <SearchBar
      className={compact ? "global-search compact" : "global-search"}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      placeholder="Search players, coaches, teams, or leagues"
      ariaLabel="Global search"
    />
  );
}
