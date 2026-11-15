"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { profileCover, profileCovers } from "./SocialProfileHeader";

type Cover = ReturnType<typeof profileCover>;

export default function ProfileAppearance({ current, onSave }: { current: Cover; onSave: (cover: Cover) => void }) {
  const [choice, setChoice] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save() {
    if (saving || choice === current) return;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const { error } = await supabase.auth.updateUser({ data: { hoopcheck_profile_cover: choice } });
      if (error) throw error;
      onSave(choice);
      setMessage("Profile cover saved.");
    } catch {
      setFailed(true);
      setMessage("Could not save your profile cover. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card hc-profile-appearance" id="profile-appearance">
      <h2>Profile appearance</h2>
      <p className="muted">Choose a cover for your profile and account screens.</p>
      <div className="hc-social-cover hc-social-cover-preview" data-profile-cover={choice} aria-hidden="true" />
      <fieldset>
        <legend>Cover color</legend>
        <div className="hc-cover-options">
          {profileCovers.map(cover => (
            <label key={cover.id} data-profile-cover={cover.id}>
              <input type="radio" name="profile-cover" value={cover.id} checked={choice === cover.id} disabled={saving}
                onChange={() => { setChoice(cover.id); setMessage(""); }} />
              <span className="hc-cover-swatch" aria-hidden="true" /> {cover.label}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn" disabled={saving || choice === current} onClick={() => void save()}>
        {saving ? "Saving…" : "Save cover"}
      </button>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
