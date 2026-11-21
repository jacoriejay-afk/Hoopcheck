import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { readWithDeadline } from "../src/native/readDeadline";
import { readOwnAffiliations } from "../src/native/ownAffiliations";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { useEntryTheme } from "../src/theme";
import { Button, GlassCard, SectionHeader } from "../src/primitives";
import { Skeleton } from "./Motion";
export function OwnAffiliations({ profileId }: { profileId: string }) {
  const t = useEntryTheme(); const active = useActiveScreen(); const { account } = useNativeAccount();
  const owner = account?.user.accountType === "player" && account.user.id === profileId ? account.user.id : null;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ owner: string; data: Awaited<ReturnType<typeof readOwnAffiliations>> | null; error: boolean } | null>(null);
  useEffect(() => {
    let live = true; const controller = new AbortController(); setState(null);
    async function load() {
      if (!owner || !active) return;
      try {
        const before = await readWithDeadline(() => supabase.auth.getSession());
        if (before.error || before.data.session?.user.id !== owner) throw Error("Session changed");
        const data = await readOwnAffiliations(supabase, { id: owner, accountType: "player" }, profileId, new Date(), controller.signal);
        const after = await readWithDeadline(() => supabase.auth.getSession());
        if (after.error || after.data.session?.user.id !== owner) throw Error("Session changed");
        if (live) setState({ owner, data, error: false });
      } catch { if (live) setState({ owner, data: null, error: true }); }
    }
    void load(); return () => { live = false; controller.abort(); };
  }, [owner, profileId, active, revision]);
  if (!owner || !active) return null;
  const current = state?.owner === owner ? state : null;
  return <View style={{ gap: t.spacing.md, marginBottom: t.spacing.xl }}><SectionHeader>Your verified team links</SectionHeader><Text style={{ color: t.muted, ...t.type.caption }}>Only visible to you here. These are recorded current affiliations within their supplied dates; they do not establish a public roster, season statistics or awards. Evidence documents are not displayed or included in your Passport.</Text>
    {!current ? <Skeleton review /> : current.error ? <><Text accessibilityRole="alert" style={{ color: t.muted }}>Your verified team links could not load.</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry team links</Button></> : !current.data?.rows.length ? <Text style={{ color: t.muted }}>No current verified team links recorded.</Text> : current.data.rows.map(row => <GlassCard key={row.id} style={{ gap: t.spacing.sm }}><Text style={{ color: t.foreground, ...t.type.section }}>{row.teamName}</Text><Text style={{ color: t.success }}>Verified current link</Text><Text style={{ color: t.muted }}>{row.start || "Start date not recorded"} · {row.end || "No end date recorded"}</Text></GlassCard>)}
    {current?.data?.limited ? <Text style={{ color: t.muted, ...t.type.caption }}>Showing the first 20 current verified links.</Text> : null}
  </View>;
}
