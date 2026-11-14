"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCachedSession, supabase } from "../lib/supabase";
import { getHoopCheckEntitlements } from "../lib/membership-tier";
import type { TagColumn } from "../lib/hoopfeed-organization";
import Surface from "./Surface";

type Preview = { id: string; body: string; post_kind: string | null };

export default function HoopFeedFromEntity({ id, column }: { id: string; column: TagColumn }) {
  const [posts, setPosts] = useState<Preview[]>([]);
  useEffect(() => {
    let active = true;
    setPosts([]);
    void (async () => {
      const { data: { session } } = await getCachedSession();
      if (!session) return;
      const userId = session.user.id;
      const [{ data: profile }, { data: subscription }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", userId).maybeSingle(),
        supabase.rpc("get_current_user_admin_role"),
      ]);
      if (!active || !getHoopCheckEntitlements({ accountType: profile?.account_type, subscription, isAdmin: role === "admin" }).canReadHoopFeed) return;
      const { data } = await supabase.from("feed_posts").select("id,body,post_kind")
        .eq(column, id).eq("status", "approved").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }).limit(5);
      if (active) setPosts(data ?? []);
    })();
    return () => { active = false; };
  }, [column, id]);

  if (!posts.length) return null;
  return <Surface as="section" className="hc-entity-feed" aria-label="From HoopFeed">
    <h2>From HoopFeed</h2>
    <ul>{posts.map(post => <li key={post.id}><Link href={`/feed#post-${post.id}`}>
      {post.body.trim().slice(0, 160) || "View media post"}
    </Link></li>)}</ul>
  </Surface>;
}
