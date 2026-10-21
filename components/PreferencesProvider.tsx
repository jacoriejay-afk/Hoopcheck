"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type ThemePreference = "system" | "light" | "dark";
export type Language = "en" | "es" | "fr" | "de" | "tr" | "pt" | "it" | "el" | "ar";

const translations: Record<Language, Record<string, string>> = {
  en: { home:"Home", feed:"HoopFeed", search:"Search", alerts:"Alerts", account:"Account", dashboard:"Dashboard", membership:"Membership", settings:"Settings", signOut:"Sign Out", playerDashboard:"PLAYER DASHBOARD", reviews:"Reviews", editProfile:"Edit Profile" },
  es: { home:"Inicio", feed:"HoopFeed", search:"Buscar", alerts:"Alertas", account:"Cuenta", dashboard:"Panel", membership:"Membresía", settings:"Configuración", signOut:"Cerrar sesión", playerDashboard:"PANEL DEL JUGADOR", reviews:"Reseñas", editProfile:"Editar perfil" },
  fr: { home:"Accueil", feed:"HoopFeed", search:"Rechercher", alerts:"Alertes", account:"Compte", dashboard:"Tableau de bord", membership:"Abonnement", settings:"Paramètres", signOut:"Déconnexion", playerDashboard:"TABLEAU DE BORD DU JOUEUR", reviews:"Avis", editProfile:"Modifier le profil" },
  de: { home:"Start", feed:"HoopFeed", search:"Suche", alerts:"Hinweise", account:"Konto", dashboard:"Dashboard", membership:"Mitgliedschaft", settings:"Einstellungen", signOut:"Abmelden", playerDashboard:"SPIELER-DASHBOARD", reviews:"Bewertungen", editProfile:"Profil bearbeiten" },
  tr: { home:"Ana Sayfa", feed:"HoopFeed", search:"Ara", alerts:"Bildirimler", account:"Hesap", dashboard:"Panel", membership:"Üyelik", settings:"Ayarlar", signOut:"Çıkış yap", playerDashboard:"OYUNCU PANELİ", reviews:"Yorumlar", editProfile:"Profili düzenle" },
  pt: { home:"Início", feed:"HoopFeed", search:"Pesquisar", alerts:"Alertas", account:"Conta", dashboard:"Painel", membership:"Assinatura", settings:"Configurações", signOut:"Sair", playerDashboard:"PAINEL DO JOGADOR", reviews:"Avaliações", editProfile:"Editar perfil" },
  it: { home:"Home", feed:"HoopFeed", search:"Cerca", alerts:"Avvisi", account:"Account", dashboard:"Dashboard", membership:"Abbonamento", settings:"Impostazioni", signOut:"Esci", playerDashboard:"DASHBOARD DEL GIOCATORE", reviews:"Recensioni", editProfile:"Modifica profilo" },
  el: { home:"Αρχική", feed:"HoopFeed", search:"Αναζήτηση", alerts:"Ειδοποιήσεις", account:"Λογαριασμός", dashboard:"Πίνακας", membership:"Συνδρομή", settings:"Ρυθμίσεις", signOut:"Αποσύνδεση", playerDashboard:"ΠΙΝΑΚΑΣ ΠΑΙΚΤΗ", reviews:"Κριτικές", editProfile:"Επεξεργασία προφίλ" },
  ar: { home:"الرئيسية", feed:"HoopFeed", search:"بحث", alerts:"التنبيهات", account:"الحساب", dashboard:"لوحة التحكم", membership:"العضوية", settings:"الإعدادات", signOut:"تسجيل الخروج", playerDashboard:"لوحة اللاعب", reviews:"التقييمات", editProfile:"تعديل الملف الشخصي" },
};

type PreferencesContextValue = {
  theme: ThemePreference;
  language: Language;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};
const PreferencesContext = createContext<PreferencesContextValue>({
  theme: "system", language: "en", setTheme: () => {}, setLanguage: () => {}, t: key => key
});
const validTheme = (value: unknown): value is ThemePreference => value === "system" || value === "light" || value === "dark";
const validLanguage = (value: unknown): value is Language => typeof value === "string" && Object.prototype.hasOwnProperty.call(translations, value);

function applyTheme(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dynamic" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function applyLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

export function usePreferences() { return useContext(PreferencesContext); }
export function useLanguage() {
  const { language, t, setLanguage } = usePreferences();
  return { language, t, setLanguage };
}

export default function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [language, setLanguageState] = useState<Language>("en");

  const setTheme = useCallback((next: ThemePreference) => {
    if (!validTheme(next)) return;
    setThemeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-theme", next);
      applyTheme(next);
      window.dispatchEvent(new CustomEvent("hoopcheck-theme-change", { detail: next }));
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void supabase.from("profiles").update({ theme_preference: next }).eq("id", data.user.id);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    if (!validLanguage(next)) return;
    setLanguageState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-language", next);
      applyLanguage(next);
      window.dispatchEvent(new CustomEvent("hoopcheck-language-change", { detail: next }));
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void supabase.from("profiles").update({ preferred_language: next }).eq("id", data.user.id);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const storedTheme = localStorage.getItem("hoopcheck-theme");
    const storedLanguage = localStorage.getItem("hoopcheck-language");
    if (validTheme(storedTheme)) { setThemeState(storedTheme); applyTheme(storedTheme); }
    else applyTheme("system");
    if (validLanguage(storedLanguage)) { setLanguageState(storedLanguage); applyLanguage(storedLanguage); }
    else applyLanguage("en");

    const onThemeEvent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (validTheme(value)) { setThemeState(value); localStorage.setItem("hoopcheck-theme", value); applyTheme(value); }
    };
    const onLanguageEvent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (validLanguage(value)) { setLanguageState(value); localStorage.setItem("hoopcheck-language", value); applyLanguage(value); }
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemTheme = () => { if ((localStorage.getItem("hoopcheck-theme") || "system") === "system") applyTheme("system"); };
    window.addEventListener("hoopcheck-theme-change", onThemeEvent);
    window.addEventListener("hoopcheck-language-change", onLanguageEvent);
    media.addEventListener?.("change", onSystemTheme);

    const loadProfile = async (userId: string) => {
      const { data } = await supabase.from("profiles").select("theme_preference,preferred_language").eq("id", userId).maybeSingle();
      if (!active || !data) return;
      // The signed-in profile is authoritative; apply it immediately without a navigation.
      if (validTheme(data.theme_preference)) {
        setThemeState(data.theme_preference);
        localStorage.setItem("hoopcheck-theme", data.theme_preference);
        applyTheme(data.theme_preference);
      }
      if (validLanguage(data.preferred_language)) {
        setLanguageState(data.preferred_language);
        localStorage.setItem("hoopcheck-language", data.preferred_language);
        applyLanguage(data.preferred_language);
      }
    };
    void supabase.auth.getUser().then(({ data }) => { if (data.user) void loadProfile(data.user.id); });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) void loadProfile(session.user.id);
    });
    return () => {
      active = false;
      window.removeEventListener("hoopcheck-theme-change", onThemeEvent);
      window.removeEventListener("hoopcheck-language-change", onLanguageEvent);
      media.removeEventListener?.("change", onSystemTheme);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ theme, language, setTheme, setLanguage, t: (key: string) => translations[language][key] || translations.en[key] || key }), [theme, language, setTheme, setLanguage]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
