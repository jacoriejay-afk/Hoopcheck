"use client";
import { useState } from "react";
import SearchBar from "./SearchBar";
import { useRouter, useSearchParams } from "next/navigation";

export default function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") || "");

e client";
import { useState } from "react";
import SearchBar from "./SearchBar";
import { useRouter, useSearchParams } from "next/navigation";

export default function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") || "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <SearchBar
      className={compact ? "global-search compact" : "global-search"}
      value={value}
      onChange={setValue}
      onSubmit={(q) => { if (q) router.push(`/search?q=${encodeURIComponent(q)}`); }}
      placeholder="Search players, coaches, teams, or leagues"
      ariaLabel="Global search"
    />
  );
}
