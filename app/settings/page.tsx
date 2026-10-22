"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useLanguage, type Language } from "../../components/LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";

type Theme = "system" | "dark" | "light";
type TeamOption = { id: string; name: string; country: string | null; league_name: string | null };
type TeamAffiliation = { id: string; team_id: string; relationship: "current" | "former"; verified: boolean; team?: TeamOption };
const normalizeTheme = (value: unknown): Theme =>
  value === "dark" || value === "light" || value === "system" ? value : value === "dynamic" ? "dark" : "system";

export default function SettingsPage() {
  const { t, language: activeLanguage, setLanguage: applyLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamAffiliations, setTeamAffiliations] = useState<TeamAffiliation[]>([]);
  const [selectedPreviousTeam, setSelectedPreviousTeam] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamMessage, setTeamMessage] = useState("");
  const [isPlayer, setIsPlayer] = useState(false);

  useEffect(() => {
    setLanguage(activeLanguage);
  }, [activeLanguage]);

  useEffect(() => {
    const localTheme = localStorage.getItem("hoopcheck-theme");
    const localLanguage = localStorage.getItem("hoopcheck-language");
    if (localTheme) setTheme(normalizeTheme(localTheme));
    if (localLanguage && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar"].includes(localLanguage)) {
      setLanguage(localLanguage as Language);
    }

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const [{ data: profile }, { data: prefs }] = await Promise.all([
        supabase.from("profiles").select("theme_preference,preferred_language").eq("id", user.id).maybeSingle(),
        supabase.from("user_preferences").select("notifications_enabled").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      const cookieHasTheme = document.cookie.split(";").some((item) => item.trim().startsWith("hoopcheck-theme="));
      if (profile?.theme_preference && !localTheme && !cookieHasTheme) setTheme(normalizeTheme(profile.theme_preference));
      if (profile?.preferred_language && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar"].includes(profile.preferred_language)) {
        setLanguage(profile.preferred_language as Language);
      }
      if (typeof prefs?.notifications_enabled === "boolean") setNotifications(prefs.notifications_enabled);
    });
    return () => { active = false; };
  }, [setTheme]);

  async function addPreviousTeam() {\n    if (!selectedPreviousTeam) { setTeamMessage("Choose a team first."); return; }\n    if (teamAffiliations.some((a) => a.team_id === selectedPreviousTeam)) { setTeamMessage("That team is already in your team history."); return; }\n    setTeamSaving(true); setTeamMessage("");\n    try {\n      const { data: { user } } = await supabase.auth.getUser();\n      if (!user) { setTeamMessage("Please sign in again to update your team history."); return; }\n      const { data, error } = await supabase.from("player_team_affiliations").insert({ user_id: user.id, team_id: selectedPreviousTeam, relationship: "former", verified: false }).select("id,team_id,relationship,verified").single();\n      if (error) throw error;\n      const team = teams.find((item) => item.id === selectedPreviousTeam);\n      if (data) setTeamAffiliations((current) => [...current, { ...data, team }]);\n      setSelectedPreviousTeam("");\n      setTeamMessage("Previous team added. It may need verification before you can submit a team review.");\n    } catch (error) {\n      console.error("Could not add previous team:", error);\n      setTeamMessage(error instanceof Error ? error.message : "Could not add that team. Please try again.");\n    } finally { setTeamSaving(false); }\n  }\n\n  async function save(nextTheme = theme, nextNotifications = notifications, nextLanguage = language) {
    setTheme(nextTheme);
    setLanguage(nextLanguage);
    setNotifications(nextNotifications);
    setSaving(true);
    setSaveMessage("");

    // The root ThemeProvider applies the class, cookie, and local preference immediately.
    applyLanguage(nextLanguage);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (user) {
        const [{ error: profileError }, { error: preferencesError }] = await Promise.all([
          supabase.from("profiles").update({
            theme_preference: nextTheme,
            preferred_language: nextLanguage,
          }).eq("id", user.id),
          // user_preferences has theme + notifications_enabled; language belongs to profiles.
          supabase.from("user_preferences").upsert({
            user_id: user.id,
            theme: nextTheme,
            notifications_enabled: nextNotifications,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" }),
        ]);
        if (profileError) throw profileError;
        if (preferencesError) throw preferencesError;
      }
      setSaveMessage(t("saved"));
    } catch (error) {
      console.error("HoopCheck settings save failed:", error);
      setSaveMessage("Your changes are active on this device, but account sync failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-page hc-settings-page">
      <section className="settings-shell">
        <div className="eyebrow">CONTROL CENTER</div>
        <h1>{t("settings")}</h1>
        <p className="muted">Tune the HoopCheck experience to match how you research the basketball world.</p>
        <div className="settings-grid">
          <section className="settings-card">
            <span className="card-kicker">{t("language").toUpperCase()}</span>
            <h2>{t("chooseLanguage")}</h2>
            <p className="muted">Choose the interface language you want HoopCheck to use. Your preference is saved to your account and this device.</p>
            <select aria-label={t("chooseLanguage")} className="language-select" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="tr">Türkçe</option><option value="pt">Português</option><option value="it">Italiano</option><option value="el">Ελληνικά</option><option value="ar">العربية</option>
            </select>
            <button type="button" className="btn" onClick={() => void save(theme, notifications, language)} disabled={saving} style={{ marginTop: 12 }}>{saving ? t("saving") : t("save")}</button>
          </section>
          <section className="settings-card">
            <span className="card-kicker">VISUAL MODE</span>
            <h2>Choose your atmosphere</h2>
            <div className="theme-options">
              {(["system", "dark", "light"] as Theme[]).map((option) => (
                <button key={option} className={"theme-option " + (theme === option ? "active" : "")} onClick={() => void save(option, notifications, language)} type="button" aria-pressed={theme === option}>
                  <strong>{option === "system" ? "Use device setting" : option === "dark" ? "Dark Mode" : "Light Mode"}</strong>
                  <small>{option === "system" ? "Follow your device appearance" : option === "dark" ? "Asphalt black" : "Clean hardwood"}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <span className="card-kicker">NOTIFICATIONS</span>
            <h2>Basketball alerts</h2>
            <p className="muted">Follow specific teams, coaches, or leagues to keep their alerts one tap away.</p>
            <button type="button" className={"toggle " + (notifications ? "on" : "")} onClick={() => void save(theme, !notifications, language)} aria-pressed={notifications}>
              <span />{notifications ? "Notifications enabled" : "Notifications disabled"}
            </button>
            <Link href="/search" className="btn dark">Find something to follow</Link>
          </section>
          <section className="settings-card">
            <span className="card-kicker">MOTION</span>
            <h2>Mobile-smooth interactions</h2>
            <p className="muted">Animations are short, touch-friendly, and respect your device&apos;s reduced-motion preference.</p>
            <div className="motion-demo"><span /><span /><span /></div>
          </section>
        </div>
        <p className="settings-save" role="status" aria-live="polite">{saving ? t("saving") : saveMessage || t("saved") + " Other preferences save automatically."}</p>
      </section>
    </main>
  );
}
