"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { usePreferences, type Language } from "../../components/PreferencesProvider";

export default function SettingsPage() {
  const { t, theme, language, setTheme, setLanguage } = usePreferences();
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: prefs } = await supabase.from("user_preferences").select("notifications_enabled").eq("user_id", user.id).maybeSingle();
      if (active && typeof prefs?.notifications_enabled === "boolean") setNotifications(prefs.notifications_enabled);
    });
    return () => { active = false; };
  }, []);

  async function saveNotifications(next: boolean) {
    setNotifications(next);
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        theme,
        notifications_enabled: next,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) console.error("Settings notification save error:", error);
    }
    setSaving(false);
  }

  const languages: { value: Language; label: string }[] = [
    { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" }, { value: "tr", label: "Türkçe" }, { value: "pt", label: "Português" },
    { value: "it", label: "Italiano" }, { value: "el", label: "Ελληνικά" }, { value: "ar", label: "العربية" }
  ];

  return (
    <main className="settings-page hc-settings-page">
      <section className="settings-shell">
        <div className="eyebrow">{t("controlCenter")}</div>
        <h1>{t("settings")}</h1>
        <p className="muted">{t("languageDescription")}</p>
        <div className="settings-grid">
          <section className="settings-card">
            <span className="card-kicker">{t("language")}</span>
            <h2>{t("chooseLanguage")}</h2>
            <p className="muted">{t("languageDescription")}</p>
            <select className="language-select" value={language} aria-label={t("language")} onChange={(event) => setLanguage(event.target.value as Language)}>
              {languages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("visualMode")}</span>
            <h2>{t("chooseTheme")}</h2>
            <div className="theme-options">
              {(["dark", "light", "system"] as const).map((option) => (
                <button key={option} className={"theme-option " + (theme === option ? "active" : "")} onClick={() => setTheme(option)} type="button">
                  <strong>{option === "dark" ? t("darkMode") : option === "light" ? t("lightMode") : t("systemMode")}</strong>
                  <small>{option === "dark" ? t("themeDarkDescription") : option === "light" ? t("themeLightDescription") : t("themeSystemDescription")}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("notifications")}</span>
            <h2>{t("basketballAlerts")}</h2>
            <p className="muted">{t("notificationsDescription")}</p>
            <button type="button" className={"toggle " + (notifications ? "on" : "")} onClick={() => void saveNotifications(!notifications)}>
              <span />{notifications ? t("notificationsEnabled") : t("notificationsDisabled")}
            </button>
            <Link href="/search" className="btn dark">{t("findToFollow")}</Link>
          </section>
          <section className="settings-card">
            <span className="card-kicker">{t("motion")}</span>
            <h2>{t("mobileInteractions")}</h2>
            <p className="muted">{t("motionDescription")}</p>
            <div className="motion-demo"><span /><span /><span /></div>
          </section>
        </div>
        <p className="settings-save">{saving ? t("saving") : t("settingsSaved")}</p>
      </section>
    </main>
  );
}
