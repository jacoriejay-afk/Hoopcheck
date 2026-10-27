"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useLanguage, type Language } from "../../components/LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";
import ThemeToast from "../../components/ThemeToast";

type Theme = "system" | "dark" | "light";
type TeamOption = { id: string; name: string; country: string | null; league_name: string | null };
type TeamAffiliation = { id: string; team_id: string; relationship: "current" | "former"; verified: boolean; team?: TeamOption };
const normalizeTheme = (value: unknown): Theme =>
  value === "dark" || value === "light" || value === "system" ? value : value === "dynamic" ? "dark" : "system";

export default function SettingsPage() {
  const router = useRouter();
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    setLanguage(activeLanguage);
  }, [activeLanguage]);

  useEffect(() => {
    const localTheme = localStorage.getItem("hoopcheck-theme");
    const localLanguage = localStorage.getItem("hoopcheck-language");
    if (localTheme) setTheme(normalizeTheme(localTheme));
    if (localLanguage && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar", "ru", "az", "pl", "zh", "ja", "sr", "fi", "he", "lt", "uk"].includes(localLanguage)) {
      setLanguage(localLanguage as Language);
    }

    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const [{ data: profile }, { data: prefs }, { data: teamsData }, { data: affiliationsData }] = await Promise.all([
        supabase.from("profiles").select("theme_preference,preferred_language,account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_preferences").select("notifications_enabled").eq("user_id", user.id).maybeSingle(),
        supabase.from("teams").select("id,name,country,league_name").eq("active", true).order("name").limit(1000),
        supabase.from("player_team_affiliations").select("id,team_id,relationship,verified").eq("user_id", user.id),
      ]);
      if (!active) return;
      const availableTeams = (teamsData ?? []) as TeamOption[];
      const affiliations = (affiliationsData ?? []) as TeamAffiliation[];
      setTeams(availableTeams);
      setTeamAffiliations(affiliations.map((a) => ({ ...a, team: availableTeams.find((team) => team.id === a.team_id) })));
      setIsPlayer(profile?.account_type === "player");
      const cookieHasTheme = document.cookie.split(";").some((item) => item.trim().startsWith("hoopcheck-theme="));
      if (profile?.theme_preference && !localTheme && !cookieHasTheme) setTheme(normalizeTheme(profile.theme_preference));
      if (profile?.preferred_language && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar", "ru", "az", "pl", "zh", "ja", "sr", "fi", "he", "lt", "uk"].includes(profile.preferred_language)) {
        setLanguage(profile.preferred_language as Language);
      }
      if (typeof prefs?.notifications_enabled === "boolean") setNotifications(prefs.notifications_enabled);
    });
    return () => { active = false; };
  }, [setTheme]);

  async function addPreviousTeam() {
    if (!selectedPreviousTeam) { setTeamMessage(t("chooseTeamFirst")); return; }
    if (teamAffiliations.some((a) => a.team_id === selectedPreviousTeam)) { setTeamMessage(t("teamAlreadyInHistory")); return; }
    setTeamSaving(true); setTeamMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setTeamMessage(t("signInToUpdateTeamHistory")); return; }
      const { data, error } = await supabase.from("player_team_affiliations").insert({ user_id: user.id, team_id: selectedPreviousTeam, relationship: "former", verified: false }).select("id,team_id,relationship,verified").single();
      if (error) throw error;
      const team = teams.find((item) => item.id === selectedPreviousTeam);
      if (data) setTeamAffiliations((current) => [...current, { ...data, team }]);
      setSelectedPreviousTeam("");
      setTeamMessage(t("previousTeamAdded"));
    } catch (error) {
      console.error("Could not add previous team:", error);
      setTeamMessage(error instanceof Error ? error.message : "Could not add that team. Please try again.");
    } finally { setTeamSaving(false); }
  }

  async function save(nextTheme = theme, nextNotifications = notifications, nextLanguage = language) {
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
      setSaveMessage("");
    } catch (error) {
      console.error("HoopCheck settings save failed:", error);
      setSaveMessage(t("accountSyncFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-page hc-settings-page">
      <section className="settings-shell">
        <div className="eyebrow">{t("controlCenter")}</div>
        <h1>{t("settings")}</h1>
        <p className="muted">{t("settingsIntro")}</p>
        <div className="settings-grid">
          <section className="settings-card">
            <span className="card-kicker">{t("language").toUpperCase()}</span>
            <h2>{t("chooseLanguage")}</h2>
            <p className="muted">{t("languageHelp")}</p>
            <select aria-label={t("chooseLanguage")} className="language-select" value={language} onChange={(e) => { const next = e.target.value as Language; setLanguage(next); void save(theme, notifications, next); }}>
              <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="it">Italiano</option><option value="pt">Português</option><option value="tr">Türkçe</option><option value="ru">Русский</option><option value="el">Ελληνικά</option><option value="sr">Српски</option><option value="pl">Polski</option><option value="lt">Lietuvių</option><option value="uk">Українська</option><option value="ar">العربية</option><option value="az">Azərbaycanca</option><option value="zh">中文</option><option value="ja">日本語</option><option value="fi">Suomi</option><option value="he">עברית</option>
            </select>
            <button type="button" className="btn" onClick={() => void save(theme, notifications, language)} disabled={saving} style={{ marginTop: 12 }}>{saving ? t("saving") : t("save")}</button>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("visualMode")}</span>
            <h2>{t("chooseAtmosphere")}</h2>
            <div className="theme-options">
              {(["system", "dark", "light"] as Theme[]).map((option) => (
                <button key={option} className={"theme-option " + (theme === option ? "active" : "")} onClick={() => void save(option, notifications, language)} type="button" aria-pressed={theme === option}>
                  <strong>{option === "system" ? t("useDeviceSetting") : option === "dark" ? t("darkMode") : t("lightMode")}</strong>
                  <small>{option === "system" ? t("followDeviceAppearance") : option === "dark" ? t("asphaltBlack") : t("cleanHardwood")}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("notifications")}</span>
            <h2>{t("basketballAlerts")}</h2>
            <p className="muted">{t("followTeamsForAlerts")}</p>
            <button type="button" className={"toggle " + (notifications ? "on" : "")} onClick={() => void save(theme, !notifications, language)} aria-pressed={notifications}>
              <span />{notifications ? "Notifications enabled" : "Notifications disabled"}
            </button>
            <Link href="/search" className="btn dark">{t("findSomethingToFollow")}</Link>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("motion")}</span>
            <h2>{t("mobileSmoothInteractions")}</h2>
            <p className="muted">{t("reducedMotionDescription")}</p>
            <div className="motion-demo"><span /><span /><span /></div>
          </section>
        </div>
        <section className="settings-card" aria-labelledby="hc-legal-heading" style={{ marginTop: 16 }}>
          <span className="card-kicker">TRUST &amp; SAFETY</span>
          <h2 id="hc-legal-heading">Legal and community safety</h2>
          <p className="muted">Review the rules for posting, reporting, blocking, and how account data is handled.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link className="btn dark" href="/terms">Terms of Service</Link>
            <Link className="btn dark" href="/privacy">Privacy Policy</Link>
            <Link className="btn dark" href="/community-guidelines">Community Guidelines</Link>
          </div>
        </section>
        <section className="settings-card" aria-labelledby="hc-delete-account-heading" style={{ marginTop: 16 }}>
          <span className="card-kicker">ACCOUNT CONTROL</span>
          <h2 id="hc-delete-account-heading">Delete Account</h2>
          <p className="muted">Permanently delete your HoopCheck account and associated profile, reviews, posts, and messages. This cannot be undone. Any active subscription is handled before deletion.</p>
          {!deleteOpen ? <button type="button" className="btn dark" onClick={() => { setDeleteOpen(true); setDeleteMessage(""); }}>Delete Account</button> : <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <p role="alert">This action is permanent. Type <strong>DELETE</strong> to confirm.</p>
            <label htmlFor="hc-delete-confirmation">Confirmation</label>
            <input id="hc-delete-confirmation" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder="Type DELETE" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="btn" disabled={deleteBusy || deleteConfirmation !== "DELETE"} onClick={async () => {
                setDeleteBusy(true); setDeleteMessage("");
                try {
                  const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
                  const payload = await response.json();
                  if (!response.ok) throw new Error(payload.error || "Account deletion failed. Your account has not been deleted.");
                  await supabase.auth.signOut();
                  router.push("/");
                } catch (error) { setDeleteMessage(error instanceof Error ? error.message : "Account deletion failed."); }
                finally { setDeleteBusy(false); }
              }}>{deleteBusy ? "Deleting…" : "Permanently Delete Account"}</button>
              <button type="button" className="btn dark" disabled={deleteBusy} onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); setDeleteMessage(""); }}>Cancel</button>
            </div>
            {deleteMessage && <p role="alert" className="message error">{deleteMessage}</p>}
          </div>}
        </section>
        <ThemeToast className="settings-save" tone={saving ? "info" : "success"}>{saving ? t("saving") : saveMessage || t("saved") + " " + t("otherPreferencesAutoSave")}</ThemeToast>
      </section>
    </main>
  );
}
