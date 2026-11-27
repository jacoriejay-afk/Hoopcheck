import { useEntryTheme, type EntryTheme } from "../src/theme";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
type State = "idle" | "checking" | "available" | "taken" | "invalid" | "error";
export type UsernameFieldHandle = { validate: () => Promise<{ valid: boolean; message?: string }>; focus: () => void };
type Props = { value: string; onChange: (value: string) => void; disabled?: boolean };

const UsernameField = forwardRef<UsernameFieldHandle, Props>(function UsernameField({ value, onChange, disabled }, ref) {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const inputRef = useRef<TextInput>(null);
  const requestRef = useRef(0);
  const inFlight = useRef<{ candidate: string; result: Promise<{ valid: boolean; message?: string }> } | null>(null);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const normalized = value.trim().toLowerCase();

  const check = useCallback((candidate: string): Promise<{ valid: boolean; message?: string }> => {
    if (inFlight.current?.candidate === candidate) return inFlight.current.result;
    const id = ++requestRef.current;
    if (!USERNAME_PATTERN.test(candidate)) {
      const text = "Use 3–20 characters: letters, numbers, or underscores.";
      setState("invalid");
      setMessage(text);
      return Promise.resolve({ valid: false, message: text });
    }
    setState("checking");
    setMessage("");
    const result = (async () => {
      try {
        const { data, error } = await supabase.rpc("is_username_available", { candidate_username: candidate });
        if (id !== requestRef.current) return { valid: false };
        if (error) throw error;
        if (data !== true) {
          const text = "That username is taken.";
          setState("taken");
          setMessage(text);
          return { valid: false, message: text };
        }
        setState("available");
        setMessage("Available");
        return { valid: true };
      } catch {
        if (id !== requestRef.current) return { valid: false };
        const text = "Availability could not be checked. Try again.";
        setState("error");
        setMessage(text);
        return { valid: false, message: text };
      }
    })().finally(() => {
      if (inFlight.current?.result === result) inFlight.current = null;
    });
    inFlight.current = { candidate, result };
    return result;
  }, []);

  const invalidate = useCallback(() => {
    requestRef.current++;
    inFlight.current = null;
  }, []);

  useEffect(() => {
    if (!normalized) { setState("idle"); setMessage(""); return invalidate; }
    if (!USERNAME_PATTERN.test(normalized)) {
      setState("invalid"); setMessage("Use 3–20 characters: letters, numbers, or underscores."); return;
    }
    const timer = setTimeout(() => { void check(normalized); }, 450);
    return () => { clearTimeout(timer); invalidate(); };
  }, [normalized, check, invalidate]);

  useImperativeHandle(ref, () => ({ validate: () => check(normalized), focus: () => inputRef.current?.focus() }), [normalized, check]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>USERNAME</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={next => {
          const candidate = next.replace(/\s+/g, "").toLowerCase();
          if (candidate !== normalized) invalidate();
          onChange(candidate);
        }}
        onBlur={() => { if (normalized) void check(normalized); }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        accessibilityLabel="Username"
        editable={!disabled}
        style={[styles.input, (state === "invalid" || state === "taken" || state === "error") && styles.inputError]}
        placeholder="yourname"
        placeholderTextColor={theme.muted}
      />
      <Text style={styles.rule}>3–20 characters — letters, numbers, underscores</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, state === "available" && styles.available, state === "checking" && styles.checking]}>{message}</Text> : null}
    </View>
  );
});

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  wrap: { marginTop: 15 },
  label: { color: theme.foreground, fontWeight: "800", letterSpacing: 1, marginBottom: 7 },
  input: { minHeight: 48, borderColor: theme.border, borderWidth: 1, borderRadius: theme.radius.control, backgroundColor: theme.input, paddingHorizontal: 13, color: theme.foreground, fontSize: 16 },
  inputError: { borderColor: theme.border, borderWidth: 2 },
  rule: { color: theme.foreground, fontSize: 12, lineHeight: 17, marginTop: 5 },
  feedback: { color: theme.foreground, fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  available: { color: theme.foreground },
  checking: { color: theme.foreground },
});

export default UsernameField;
