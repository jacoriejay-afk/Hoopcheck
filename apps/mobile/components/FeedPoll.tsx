import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { feedAction, readPollTotals } from "../src/native/feedClient";
import { useEntryTheme } from "../src/theme";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
export function FeedPoll({ userId, postId, options, enabled }: { userId: string; postId: string; options: string[]; enabled: boolean }) {
  const theme = useEntryTheme();
  const [owner, setOwner] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [mine, setMine] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!enabled) return;
    void readPollTotals(supabase, postId).then(rows => {
      if (!active) return;
      const next: Record<number, number> = {};
      let selected: number | null = null;
      for (const row of rows) {
        const index = Number(row.option_index), count = Number(row.votes_count);
        if (Number.isInteger(index) && index >= 0 && index < options.length && Number.isSafeInteger(count) && count >= 0) { next[index] = count; if (row.voted_by_me === true) selected = index; }
      }
      setOwner(userId); setCounts(next); setMine(selected);
    }).catch(() => { if (active) setError("Poll totals unavailable. Tap an option to vote or change your vote."); });
    return () => { active = false; };
  }, [userId, postId, options.length, enabled, revision]);
  async function vote(index: number) {
    if (!enabled || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session || data.session.user.id !== userId) throw new Error("Sign in again before voting.");
      await feedAction(origin, data.session.access_token, "vote", postId, index);
      setRevision(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vote could not be confirmed."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {options.map((option, index) => <Pressable key={index} accessibilityRole="button" aria-pressed={owner === userId && mine === index} accessibilityState={{ selected: owner === userId && mine === index, disabled: busy || !enabled }} disabled={busy || !enabled} onPress={() => void vote(index)} style={{ minHeight: 48, padding: 12, borderRadius: theme.radius.control, backgroundColor: owner === userId && mine === index ? theme.accentSurface : theme.chip, borderWidth: 1, borderColor: owner === userId && mine === index ? theme.accent : theme.border }}>
      <Text style={{ color: theme.foreground }}>{option}{owner !== userId || counts[index] === undefined ? "" : ` · ${counts[index]}`}{owner === userId && mine === index ? " ✓" : ""}</Text>
    </Pressable>)}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text> : null}
  </View>;
}
