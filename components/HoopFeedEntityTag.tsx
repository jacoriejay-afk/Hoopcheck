"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ENTITY_TAGS, type EntityTag, type TagColumn } from "../lib/hoopfeed-organization";

export default function HoopFeedEntityTag({ value, onChange }: {
  value: EntityTag | null;
  onChange: (tag: EntityTag | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityTag[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const term = query.trim().replace(/[%_\\]/g, "");
    if (value || term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const matches = await Promise.all((Object.keys(ENTITY_TAGS) as TagColumn[]).map(async column => {
        const result = await supabase.from(ENTITY_TAGS[column].table).select("id,name,country")
          .eq("active", true).ilike("name", `%${term}%`).order("name").limit(5);
        return { ...result, tags: (result.data ?? []).map(row => ({ ...row, column })) };
      }));
      if (!active) return;
      setResults(matches.flatMap(result => result.tags));
      setStatus(matches.some(result => result.error) ? "Some directory results could not be loaded."
        : matches.every(result => !result.tags.length) ? "No matching clubs or leagues." : "");
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, value]);

  return <div className="hc-feed-tag-picker">
    {value ? <button type="button" className="hf5-type-chip is-active" onClick={() => onChange(null)}
      aria-label={`Remove ${value.name} tag`}>{value.name} ×</button> : <>
      <label>Tag a club or league <span className="muted">(optional)</span>
        <input type="search" value={query} onChange={event => {
          setResults([]); setStatus(""); setQuery(event.target.value);
        }} />
      </label>
      {results.length > 0 && <ul>
        {results.map(tag => <li key={tag.column + tag.id}><button type="button" onClick={() => {
          onChange(tag); setQuery(""); setResults([]);
        }}>{tag.name} <small>{tag.column.includes("league") ? "League" : "Club"}{tag.country && ` · ${tag.country}`}</small></button></li>)}
      </ul>}
      {status && <small role="status">{status}</small>}
    </>}
  </div>;
}
