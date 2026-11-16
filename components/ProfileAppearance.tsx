"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { profileCover, profileCovers } from "./SocialProfileHeader";

type Cover = ReturnType<typeof profileCover>;

export default function ProfileAppearance({ current, onSave }: { current: Cover; onSave: (cover: Cover) => void }) {
  const [choice, setChoice] = useState(current);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<"standard" | "compact">("standard");
  const [savedLayout, setSavedLayout] = useState<"standard" | "compact">("standard");
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      const selected = user?.user_metadata?.hoopcheck_profile_layout === "compact" ? "compact" : "standard";
      setLayout(selected); setSavedLayout(selected);
    });
    return () => { active = false; };
  }, []);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save() {
    if (saving || (choice === current && layout === savedLayout)) return;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const { error } = await supabase.auth.updateUser({ data: { hoopcheck_profile_cover: choice, hoopcheck_profile_layout: layout } });
      if (error) throw error;
      onSave(choice);
      setSavedLayout(layout);
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
      <fieldset>
        <legend>Profile layout</legend>
        <div className="hc-cover-options">
          {(["standard", "compact"] as const).map(option => <label key={option}>
            <input type="radio" name="profile-layout" value={option} checked={layout === option} disabled={saving}
              onChange={() => { setLayout(option); setMessage(""); }} />
            {option === "standard" ? "Standard · spacious" : "Compact · more on screen"}
          </label>)}
        </div>
      </fieldset>
      <button type="button" className="btn" disabled={saving || (choice === current && layout === savedLayout)} onClick={() => void save()}>
        {saving ? "Saving…" : "Save cover"}
      </button>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
