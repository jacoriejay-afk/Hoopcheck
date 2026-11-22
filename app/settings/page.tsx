"use client";

import { getOwnProfile } from "../../lib/auth/own-profile";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useLanguage, type Language } from "../../components/LanguageProvider";
import { useTheme } from "../../components/ThemeProvider";
import ThemeToast from "../../components/ThemeToast";

type Theme = "system" | "dark" | "light";
const normalizeTheme = (value: unknown): Theme =>
  value === "dark" || value === "light" || value === "system" ? value : value === "dynamic" ? "dark" : "system";

export default function SettingsPage() {
  const { t, language: activeLanguage, setLanguage: applyLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  // The in-flight account profile must not replace a language just selected here.
  const languageChangedByUser = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isPlayer, setIsPlayer] = useState(false);

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
      const [{ data: profile }, { data: prefs }] = await Promise.all([
        getOwnProfile(supabase, user.id),
        supabase.from("user_preferences").select("notifications_enabled").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setIsPlayer(profile?.account_type === "player");
      const cookieHasTheme = document.cookie.split(";").some((item) => item.trim().startsWith("hoopcheck-theme="));
      if (profile?.theme_preference && !localTheme && !cookieHasTheme) setTheme(normalizeTheme(profile.theme_preference));
      if (!languageChangedByUser.current && profile?.preferred_language && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar", "ru", "az", "pl", "zh", "ja", "sr", "fi", "he", "lt", "uk"].includes(profile.preferred_language)) {
        setLanguage(profile.preferred_language as Language);
      }
      if (typeof prefs?.notifications_enabled === "boolean") setNotifications(prefs.notifications_enabled);
    });
    return () => { active = false; };
  }, [setTheme]);


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
        <nav className="hc-settings-shortcuts hc-settings-organized-nav" aria-label="Account and settings sections">
          <Link href="/account#account-settings">Profile & account</Link>
          {isPlayer&&<Link href="/profile#career-passport">Career history</Link>}
          {isPlayer&&<Link href="/account#team-review-checklist">Team reviews</Link>}
          <Link href="/membership">Membership</Link>
          <Link href="/account#account-settings">Security</Link>
          <Link href="/privacy-center">Privacy</Link>
          <Link href="/notifications">Alerts</Link>
          <Link href="/notifications?tab=messages">Messages</Link>
          <Link href="/support">Help</Link>
        </nav>
        <div className="settings-grid">
          <section className="settings-card">
            <span className="card-kicker">{t("language").toUpperCase()}</span>
            <h2>{t("chooseLanguage")}</h2>
            <p className="muted">{t("languageHelp")}</p>
            <select aria-label={t("chooseLanguage")} className="language-select" value={language} onChange={(e) => { const next = e.target.value as Language; languageChangedByUser.current = true; setLanguage(next); void save(theme, notifications, next); }}>
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
            <span className="card-kicker">ACCOUNT TOOLS</span>
            <h2>Your HoopCheck workspace</h2>
            <p className="muted">Keep profile editing, career history and reviews separate from app preferences.</p>
            <div className="hc-settings-workspace-links">
              <Link href="/account">Edit profile</Link>
              {isPlayer&&<Link href="/profile#career-passport">Career Passport</Link>}
              {isPlayer&&<Link href="/account#team-review-checklist">Review a team</Link>}
              <Link href="/account#account-settings">Security settings</Link>
            </div>
          </section>
        </div>
        <ThemeToast className="settings-save" tone={saving ? "info" : "success"}>{saving ? t("saving") : saveMessage || t("saved") + " " + t("otherPreferencesAutoSave")}</ThemeToast>
      </section>
    </main>
  );
}
