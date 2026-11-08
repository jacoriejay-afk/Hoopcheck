import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
type State = "idle" | "checking" | "available" | "taken" | "invalid" | "error";
export type UsernameFieldHandle = { validate: () => Promise<{ valid: boolean; message?: string }>; focus: () => void };
type Props = { value: string; onChange: (value: string) => void; disabled?: boolean };

const UsernameField = forwardRef<UsernameFieldHandle, Props>(function UsernameField({ value, onChange, disabled }, ref) {
  const inputRef = useRef<TextInput>(null);
  const requestRef = useRef(0);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const normalized = value.trim().toLowerCase();

  const check = useCallback(async (candidate: string): Promise<{ valid: boolean; message?: string }> => {
    if (!USERNAME_PATTERN.test(candidate)) {
      const text = "Use 3–20 characters: letters, numbers, or underscores.";
      setState("invalid"); setMessage(text); return { valid: false, message: text };
    }
    const id = ++requestRef.current;
    setState("checking"); setMessage("");
    try {
      const { data, error } = await supabase.rpc("is_username_available", { candidate_username: candidate });
      if (id !== requestRef.current) return { valid: false };
      if (error) throw error;
      if (data !== true) {
        setState("taken"); setMessage("That username is taken.");
        return { valid: false, message: "That username is taken." };
      }
      setState("available"); setMessage("✓ available");
      return { valid: true };
    } catch (error) {
      if (id !== requestRef.current) return { valid: false };
      console.error("Username availability check failed:", error);
      setState("error"); setMessage("We couldn't check availability. Please try again.");
      return { valid: false, message: "We couldn't check availability. Please try again." };
    }
  }, []);

  useEffect(() => {
    if (!normalized) { requestRef.current++; setState("idle"); setMessage(""); return; }
    if (!USERNAME_PATTERN.test(normalized)) {
      requestRef.current++;
      setState("invalid"); setMessage("Use 3–20 characters: letters, numbers, or underscores."); return;
    }
    const timer = setTimeout(() => { void check(normalized); }, 450);
    return () => clearTimeout(timer);
  }, [normalized, check]);

  useImperativeHandle(ref, () => ({ validate: () => check(normalized), focus: () => inputRef.current?.focus() }), [normalized, check]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>USERNAME</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\s+/g, "").toLowerCase())}
        onBlur={() => { if (normalized) void check(normalized); }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        accessibilityLabel="Username"
        editable={!disabled}
        style={[styles.input, (state === "invalid" || state === "taken" || state === "error") && styles.inputError]}
        placeholder="yourname"
        placeholderTextColor="#8D929A"
      />
      <Text style={styles.rule}>3–20 characters — letters, numbers, underscores</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, state === "available" && styles.available, state === "checking" && styles.checking]}>{message}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: 15 },
  label: { color: "#F7F7F5", fontWeight: "800", letterSpacing: 1, marginBottom: 7 },
  input: { minHeight: 48, borderColor: "#62666D", borderWidth: 1, borderRadius: 10, backgroundColor: "#111111", paddingHorizontal: 13, color: "#FFFFFF", fontSize: 16 },
  inputError: { borderColor: "#F04438", borderWidth: 2 },
  rule: { color: "#BDBDBD", fontSize: 12, lineHeight: 17, marginTop: 5 },
  feedback: { color: "#F97066", fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  available: { color: "#32C875" },
  checking: { color: "#BDBDBD" },
});

export default UsernameField;
