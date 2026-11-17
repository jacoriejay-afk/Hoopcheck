"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Access = { owner: boolean; staff: boolean; ambassador: boolean };

export default function AccountWorkspaces({ userId }: { userId: string }) {
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void fetch("/api/account/workspaces", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (!controller.signal.aborted) setAccess(result); })
      .catch(() => { if (!controller.signal.aborted) setAccess(null); });
    return () => controller.abort();
  }, [userId]);

  if (!access || !(access.owner || access.staff || access.ambassador)) return null;

  return (
    <section className="dashboard-card" aria-labelledby="account-workspaces">
      <h2 id="account-workspaces">Workspaces</h2>
      <nav className="hc-social-profile-nav" aria-label="Workspace shortcuts">
        {access.owner && <Link href="/owner-hq" prefetch={false}>Open Owner HQ</Link>}
        {access.ambassador && <Link href="/ambassador-hq" prefetch={false}>Open Ambassador HQ</Link>}
        {access.staff && <Link href="/admin/directory">Admin Control Center</Link>}
        {access.owner && <Link href="/admin/ambassadors" prefetch={false}>Ambassador administration</Link>}
        {access.staff && <Link href="/admin/reviews">Manage reviews</Link>}
        {access.staff && <Link href="/admin/rights">Rights coverage</Link>}
      </nav>
    </section>
  );
}
