"use client";
import { FormEvent, useState } from "react";
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
    <form className={compact ? "global-search compact" : "global-search"} onSubmit={submit} role="search">
      <span aria-hidden="true">⌕</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search HoopCheck..." aria-label="Global search" />
      <button type="submit">Search</button>
    </form>
  );
}
