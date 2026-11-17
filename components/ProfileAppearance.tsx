"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { profileCover, profileCovers } from "./SocialProfileHeader";

type Cover = ReturnType<typeof profileCover>;
type SocialKey = "instagram" | "tiktok" | "youtube" | "website";
const socialFields: { key: SocialKey; label: string; host?: string }[] = [
  { key: "instagram", label: "Instagram", host: "instagram.com" },
  { key: "tiktok", label: "TikTok", host: "tiktok.com" },
  { key: "youtube", label: "YouTube", host: "youtube.com" },
  { key: "website", label: "Website" },
];
function validSocialUrl(value: string, host?: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || value.length > 250) return false;
    if (host && url.hostname !== host && url.hostname !== "www." + host && !(host === "youtube.com" && url.hostname === "youtu.be")) return false;
    return true;
  } catch { return false; }
}

export default function ProfileAppearance({ current, onSave }: { current: Cover; onSave: (cover: Cover) => void }) {
  const [choice, setChoice] = useState(current);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<"standard" | "compact">("standard");
  const [savedLayout, setSavedLayout] = useState<"standard" | "compact">("standard");
  const [links, setLinks] = useState<Record<SocialKey, string>>({ instagram: "", tiktok: "", youtube: "", website: "" });
  const [savedLinks, setSavedLinks] = useState<Record<SocialKey, string>>({ instagram: "", tiktok: "", youtube: "", website: "" });
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      const selected = user?.user_metadata?.hoopcheck_profile_layout === "compact" ? "compact" : "standard";
      setLayout(selected); setSavedLayout(selected);
      const metadata = user?.user_metadata?.hoopcheck_social_links;
      const next = { instagram: "", tiktok: "", youtube: "", website: "" };
      if (metadata && typeof metadata === "object") {
        for (const field of socialFields) {
          const value = metadata[field.key];
          if (typeof value === "string" && validSocialUrl(value, field.host)) next[field.key] = value;
        }
      }
      setLinks(next); setSavedLinks(next);
    });
    return () => { active = false; };
  }, []);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save() {
    if (saving || (choice === current && layout === savedLayout && JSON.stringify(links) === JSON.stringify(savedLinks))) return;
    for (const field of socialFields) {
      if (!validSocialUrl(links[field.key].trim(), field.host)) {
        setFailed(true); setMessage(`Enter a valid HTTPS ${field.label} URL.`); return;
      }
    }
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const { error } = await supabase.auth.updateUser({ data: { hoopcheck_profile_cover: choice, hoopcheck_profile_layout: layout, hoopcheck_social_links: Object.fromEntries(socialFields.map(field => [field.key, links[field.key].trim()])) } });
      if (error) throw error;
      onSave(choice);
      setSavedLayout(layout);
      setSavedLinks({ ...links });
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
      <fieldset>
        <legend>Social links</legend>
        <p className="muted">Optional HTTPS links shown on your profile.</p>
        <div style={{ display: "grid", gap: ".75rem" }}>
          {socialFields.map(field => <label key={field.key} style={{ display: "grid", gap: ".25rem" }}>
            <span>{field.label}</span>
            <input type="url" inputMode="url" maxLength={250} value={links[field.key]} disabled={saving}
              placeholder={field.host ? `https://${field.host}/yourprofile` : "https://yourwebsite.com"}
              onChange={event => setLinks(current => ({ ...current, [field.key]: event.target.value }))} />
          </label>)}
        </div>
      </fieldset>
      <button type="button" className="btn" disabled={saving || (choice === current && layout === savedLayout && JSON.stringify(links) === JSON.stringify(savedLinks))} onClick={() => void save()}>
        {saving ? "Saving…" : "Save cover"}
      </button>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
