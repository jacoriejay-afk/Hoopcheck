import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { feedAction, readPollTotals } from "../src/native/feedClient";
import { useEntryTheme } from "../src/theme";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
export function FeedPoll({ postId, options, enabled }: { postId: string; options: string[]; enabled: boolean }) {
  const theme = useEntryTheme();
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
      setCounts(next); setMine(selected);
    }).catch(() => { if (active) setError("Poll totals unavailable. Tap an option to vote or change your vote."); });
    return () => { active = false; };
  }, [postId, options.length, enabled, revision]);
  async function vote(index: number) {
    if (!enabled || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session) throw new Error("Sign in again before voting.");
      await feedAction(origin, data.session.access_token, "vote", postId, index);
      setRevision(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vote could not be confirmed."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {options.map((option, index) => <Pressable key={index} accessibilityRole="button" aria-pressed={mine === index} accessibilityState={{ selected: mine === index, disabled: busy || !enabled }} disabled={busy || !enabled} onPress={() => void vote(index)} style={{ minHeight: 48, padding: 12, borderRadius: theme.radius.control, backgroundColor: mine === index ? theme.accentSurface : theme.chip, borderWidth: 1, borderColor: mine === index ? theme.accent : theme.border }}>
      <Text style={{ color: theme.foreground }}>{option}{counts[index] === undefined ? "" : ` · ${counts[index]}`}{mine === index ? " ✓" : ""}</Text>
    </Pressable>)}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text> : null}
  </View>;
}
