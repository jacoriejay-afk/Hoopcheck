"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
type Availability = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export type UsernameFieldHandle = {
  validate: () => Promise<{ valid: boolean; message?: string }>;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const UsernameField = forwardRef<UsernameFieldHandle, Props>(function UsernameField(
  { value, onChange, disabled = false }, ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState("");

  const normalized = value.trim().toLowerCase();

  const checkAvailability = useCallback(async (candidate: string): Promise<{ valid: boolean; message?: string }> => {
    if (!USERNAME_PATTERN.test(candidate)) {
      setAvailability("invalid");
      setError("Use 3–20 characters: letters, numbers, or underscores.");
      return { valid: false, message: "Use 3–20 characters: letters, numbers, or underscores." };
    }
    const requestId = ++requestRef.current;
    setAvailability("checking");
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("is_username_available", {
        candidate_username: candidate,
      });
      if (requestId !== requestRef.current) return { valid: false };
      if (rpcError) throw rpcError;
      if (data !== true) {
        setAvailability("taken");
        setError("That username is taken.");
        return { valid: false, message: "That username is taken." };
      }
      setAvailability("available");
      setError("");
      return { valid: true };
    } catch (checkError) {
      if (requestId !== requestRef.current) return { valid: false };
      console.error("Username availability check failed:", checkError);
      setAvailability("error");
      setError("We couldn't check availability. Please try again.");
      return { valid: false, message: "We couldn't check availability. Please try again." };
    }
  }, []);

  useEffect(() => {
    if (!normalized) {
      requestRef.current++;
      setAvailability("idle");
      setError("");
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      requestRef.current++;
      setAvailability("invalid");
      setError("Use 3–20 characters: letters, numbers, or underscores.");
      return;
    }
    const timer = window.setTimeout(() => { void checkAvailability(normalized); }, 450);
    return () => window.clearTimeout(timer);
  }, [normalized, checkAvailability]);

  useImperativeHandle(ref, () => ({
    validate: async () => checkAvailability(normalized),
    focus: () => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    },
  }), [normalized, checkAvailability]);

  const message = error || (availability === "available" ? "✓ available" : "");
  return (
    <div className="hc-username-field">
      <label htmlFor="username">USERNAME</label>
      <input
        ref={inputRef}
        id="username"
        name="username"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\s+/g, "").toLowerCase())}
        onBlur={() => { if (normalized) void checkAvailability(normalized); }}
        autoComplete="username"
        autoCapitalize="none"
        inputMode="text"
        spellCheck={false}
        placeholder="yourname"
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby="username-rule username-feedback"
        className={error ? "is-invalid" : ""}
      />
      <p id="username-rule" className="hc-username-rule">3–20 characters — letters, numbers, underscores</p>
      <p
        id="username-feedback"
        className={availability === "available" ? "hc-username-feedback is-available" : "hc-username-feedback"}
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        {availability === "checking" ? "Checking availability…" : message}
      </p>
    </div>
  );
});

export default UsernameField;
