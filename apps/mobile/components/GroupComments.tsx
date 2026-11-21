import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useNativeDraft } from "../src/native/drafts";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { requireOnline } from "../src/native/network";
import { clubGroupAction, readGroupComments, type GroupComment } from "../src/native/clubGroups";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
export function GroupComments({ postId, teamId, userId, canWrite }: { postId: string; teamId: string; userId: string; canWrite: boolean }) {
  const theme = useEntryTheme();
  const [rows, setRows] = useState<GroupComment[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useNativeDraft(`group:comment:${postId}`, userId);
  const [error, setError] = useState("");
  const request = useRef(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let valid = true;
    setLoading(true); setError("");
    void readGroupComments(supabase, postId, page).then(result => {
      if (!valid) return;
      setRows(previous => page ? [...new Map([...previous, ...result.comments].map(row => [row.id, row])).values()] : result.comments); setMore(result.more);
    }).catch(() => { if (valid) { setRows([]); setError("Comments could not load. Try again."); } }).finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [postId, page, revision]);
  async function send() {
    if (!canWrite || request.current || !draft.trim()) return;
    request.current = true; setSending(true); setError("");
    const text = draft;
    try {
      await requireOnline();
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || data.session?.user.id !== userId) throw new Error("Session changed. Sign in again.");
      await clubGroupAction(origin, data.session.access_token, teamId, "comment", { postId, text });
      setDraft(current => current === text ? "" : current); setPage(0); setRevision(value => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Comment could not be confirmed. Your draft is retained."); }
    finally { request.current = false; setSending(false); }
  }
  return <View style={{ gap: 12 }}>
    {rows.map(comment => <View key={comment.id} style={{ gap: 4 }}><Text style={{ color: theme.foreground, fontWeight: "800" }}>{comment.profiles?.display_name || "HoopCheck member"}</Text><Text style={{ color: theme.foreground }}>{comment.body}</Text></View>)}
    {loading ? <Text style={{ color: theme.muted }}>Loading comments…</Text> : !rows.length && !error ? <Text style={{ color: theme.muted }}>No comments yet.</Text> : null}
    {more ? <Button secondary disabled={loading} onPress={() => setPage(value => value + 1)}>More comments</Button> : null}
    {canWrite ? <><TextInput accessibilityLabel="Club group comment" maxLength={1000} placeholder="Write a comment" placeholderTextColor={theme.muted} value={draft} onChangeText={setDraft} style={{ minHeight: 48, color: theme.foreground, backgroundColor: theme.input, padding: 12, borderRadius: theme.radius.control }} /><Button secondary disabled={sending || !draft.trim()} onPress={() => void send()}>{sending ? "Checking safety…" : "Send comment"}</Button></> : null}
    {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry comments</Button></View> : null}
  </View>;
}
