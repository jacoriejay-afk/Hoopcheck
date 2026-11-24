import { ambassadorDb } from "../ambassador/server";

async function getReferralClickTotal(db: ReturnType<typeof ambassadorDb> | null) {
  const label = "Ambassador referral clicks";
  if (!db) return { label, value: "Unavailable" };

  const pageSize = 100;
  let afterId: string | undefined;
  let total = BigInt(0);
  for (;;) {
    const page = db.from("ambassador_clicks").select("ambassador_id, clicks")
      .order("ambassador_id").limit(pageSize);
    const { data, error } = await (afterId ? page.gt("ambassador_id", afterId) : page);
    if (error || !data) return { label, value: "Unavailable" };
    for (const { clicks } of data) {
      if (!Number.isSafeInteger(clicks) || clicks < 0) return { label, value: "Unavailable" };
      total += BigInt(clicks);
    }
    if (data.length < pageSize) return { label, value: String(total) };
    afterId = data[data.length - 1].ambassador_id;
  }
}

export async function getOwnerMetrics() {
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? ambassadorDb() : null;
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const options = { count: "exact", head: true } as const;

  async function metric(
    label: string,
    query?: PromiseLike<{ count: number | null; error: unknown }>,
  ) {
    const result = await query;
    const value = !result || result.error || result.count == null ? "Unavailable" : String(result.count);
    return { label, value };
  }

  return Promise.all([
    metric("Registered profiles", db?.from("profiles").select("*", options)),
    metric("Profiles created in the last 30 days", db?.from("profiles").select("*", options)
      .gte("created_at", since)),
    metric("Active/trialing subscription records", db?.from("subscriptions").select("*", options)
      .in("status", ["active", "trialing"])),
    getReferralClickTotal(db),
    metric("Attributed signups", db?.from("ambassador_attributions").select("*", options)),
    metric("Qualified paying referrals", db?.from("ambassador_attributions").select("*", options)
      .not("first_paid_at", "is", null).is("disqualified_at", null)),
    metric("Pending commission records", db?.from("ambassador_commissions").select("*", options)
      .eq("status", "pending")),
    metric("Approved payouts awaiting payment", db?.from("ambassador_payouts").select("*", options)
      .eq("status", "approved")),
  ]);
}

