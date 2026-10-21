"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type ThemePreference = "system" | "light" | "dark";
export type Language = "en" | "es" | "fr" | "de" | "tr" | "pt" | "it" | "el" | "ar";

const translations: Record<Language, Record<string, string>> = {
  en: { home:"Home", feed:"HoopFeed", search:"Search", alerts:"Alerts", account:"Account", dashboard:"Dashboard", directory:"Directory", teams:"Teams", coaches:"Coaches", leagues:"Leagues", membership:"Membership", settings:"Settings", signOut:"Sign Out", signIn:"Sign In", reviews:"Reviews", playerDashboard:"PLAYER DASHBOARD", editProfile:"Edit Profile", language:"Language", chooseLanguage:"Choose your language", languageDescription:"Choose the interface language for HoopCheck.", visualMode:"VISUAL MODE", chooseTheme:"Choose your theme", darkMode:"Dark mode", lightMode:"Light mode", systemMode:"Use device setting", notifications:"Notifications", basketballAlerts:"Basketball alerts", motion:"Motion", mobileInteractions:"Mobile-smooth interactions", settingsSaved:"Settings saved automatically.", saving:"Saving…", controlCenter:"CONTROL CENTER", findToFollow:"Find something to follow", playerUsername:"Player username", enterUsername:"Enter the player username first.", finding:"Finding…", findPlayer:"Find Player", noPlayer:"No player found with that username.", tryAgain:"We couldn’t find that username. Try again.", profile:"Profile", save:"Save", cancel:"Cancel", all:"All", teamsDirectory:"Teams Directory", searchPlaceholder:"Search teams, coaches, leagues, players…", noResults:"No results found." },
  es: { home:"Inicio", feed:"HoopFeed", search:"Buscar", alerts:"Alertas", account:"Cuenta", dashboard:"Panel", directory:"Directorio", teams:"Equipos", coaches:"Entrenadores", leagues:"Ligas", membership:"Membresía", settings:"Configuración", signOut:"Cerrar sesión", signIn:"Iniciar sesión", reviews:"Reseñas", playerDashboard:"PANEL DEL JUGADOR", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Elige tu idioma", languageDescription:"Elige el idioma de la interfaz de HoopCheck.", visualMode:"MODO VISUAL", chooseTheme:"Elige tu tema", darkMode:"Modo oscuro", lightMode:"Modo claro", systemMode:"Usar ajuste del dispositivo", notifications:"Notificaciones", basketballAlerts:"Alertas de baloncesto", motion:"Movimiento", mobileInteractions:"Interacciones fluidas en móvil", settingsSaved:"La configuración se guarda automáticamente.", saving:"Guardando…", controlCenter:"CENTRO DE CONTROL", findToFollow:"Encuentra algo para seguir", playerUsername:"Nombre de usuario del jugador", enterUsername:"Introduce primero el nombre de usuario.", finding:"Buscando…", findPlayer:"Buscar jugador", noPlayer:"No se encontró ningún jugador con ese nombre.", tryAgain:"No pudimos encontrar ese usuario. Inténtalo de nuevo.", profile:"Perfil", save:"Guardar", cancel:"Cancelar", all:"Todos", teamsDirectory:"Directorio de equipos", searchPlaceholder:"Buscar equipos, entrenadores, ligas y jugadores…", noResults:"No se encontraron resultados." },
  fr: { home:"Accueil", feed:"HoopFeed", search:"Rechercher", alerts:"Alertes", account:"Compte", dashboard:"Tableau de bord", directory:"Répertoire", teams:"Équipes", coaches:"Entraîneurs", leagues:"Ligues", membership:"Abonnement", settings:"Paramètres", signOut:"Déconnexion", signIn:"Connexion", reviews:"Avis", playerDashboard:"TABLEAU DE BORD DU JOUEUR", editProfile:"Modifier le profil", language:"Langue", chooseLanguage:"Choisissez votre langue", languageDescription:"Choisissez la langue de l’interface HoopCheck.", visualMode:"MODE VISUEL", chooseTheme:"Choisissez votre thème", darkMode:"Mode sombre", lightMode:"Mode clair", systemMode:"Utiliser le réglage de l’appareil", notifications:"Notifications", basketballAlerts:"Alertes basket", motion:"Animations", mobileInteractions:"Interactions fluides sur mobile", settingsSaved:"Les paramètres sont enregistrés automatiquement.", saving:"Enregistrement…", controlCenter:"CENTRE DE CONTRÔLE", findToFollow:"Trouver à suivre", playerUsername:"Nom d’utilisateur du joueur", enterUsername:"Saisissez d’abord le nom d’utilisateur.", finding:"Recherche…", findPlayer:"Trouver le joueur", noPlayer:"Aucun joueur trouvé avec ce nom.", tryAgain:"Nom d’utilisateur introuvable. Réessayez.", profile:"Profil", save:"Enregistrer", cancel:"Annuler", all:"Tout", teamsDirectory:"Répertoire des équipes", searchPlaceholder:"Rechercher équipes, entraîneurs, ligues, joueurs…", noResults:"Aucun résultat trouvé." },
  de: { home:"Start", feed:"HoopFeed", search:"Suche", alerts:"Hinweise", account:"Konto", dashboard:"Dashboard", directory:"Verzeichnis", teams:"Teams", coaches:"Trainer", leagues:"Ligen", membership:"Mitgliedschaft", settings:"Einstellungen", signOut:"Abmelden", signIn:"Anmelden", reviews:"Bewertungen", playerDashboard:"SPIELER-DASHBOARD", editProfile:"Profil bearbeiten", language:"Sprache", chooseLanguage:"Sprache auswählen", languageDescription:"Wähle die HoopCheck-Oberflächensprache.", visualMode:"DARSTELLUNG", chooseTheme:"Darstellung auswählen", darkMode:"Dunkelmodus", lightMode:"Hellmodus", systemMode:"Geräteeinstellung verwenden", notifications:"Benachrichtigungen", basketballAlerts:"Basketball-Benachrichtigungen", motion:"Bewegung", mobileInteractions:"Flüssige mobile Interaktionen", settingsSaved:"Einstellungen werden automatisch gespeichert.", saving:"Speichern…", controlCenter:"KONTROLLZENTRUM", findToFollow:"Etwas zum Folgen finden", playerUsername:"Spieler-Benutzername", enterUsername:"Gib zuerst den Benutzernamen ein.", finding:"Suche…", findPlayer:"Spieler finden", noPlayer:"Kein Spieler mit diesem Namen gefunden.", tryAgain:"Benutzername nicht gefunden. Bitte erneut versuchen.", profile:"Profil", save:"Speichern", cancel:"Abbrechen", all:"Alle", teamsDirectory:"Teamverzeichnis", searchPlaceholder:"Teams, Trainer, Ligen und Spieler suchen…", noResults:"Keine Ergebnisse gefunden." },
  tr: { home:"Ana Sayfa", feed:"HoopFeed", search:"Ara", alerts:"Bildirimler", account:"Hesap", dashboard:"Panel", directory:"Dizin", teams:"Takımlar", coaches:"Koçlar", leagues:"Ligler", membership:"Üyelik", settings:"Ayarlar", signOut:"Çıkış yap", signIn:"Giriş yap", reviews:"Yorumlar", playerDashboard:"OYUNCU PANELİ", editProfile:"Profili düzenle", language:"Dil", chooseLanguage:"Dilini seç", languageDescription:"HoopCheck arayüz dilini seç.", visualMode:"GÖRÜNÜM", chooseTheme:"Temanı seç", darkMode:"Koyu mod", lightMode:"Açık mod", systemMode:"Cihaz ayarını kullan", notifications:"Bildirimler", basketballAlerts:"Basketbol uyarıları", motion:"Hareket", mobileInteractions:"Akıcı mobil etkileşimler", settingsSaved:"Ayarlar otomatik kaydedilir.", saving:"Kaydediliyor…", controlCenter:"KONTROL MERKEZİ", findToFollow:"Takip edilecek bir şey bul", playerUsername:"Oyuncu kullanıcı adı", enterUsername:"Önce oyuncu kullanıcı adını gir.", finding:"Bulunuyor…", findPlayer:"Oyuncuyu bul", noPlayer:"Bu kullanıcı adına sahip oyuncu bulunamadı.", tryAgain:"Kullanıcı adı bulunamadı. Tekrar dene.", profile:"Profil", save:"Kaydet", cancel:"İptal", all:"Tümü", teamsDirectory:"Takım dizini", searchPlaceholder:"Takım, koç, lig ve oyuncu ara…", noResults:"Sonuç bulunamadı." },
  pt: { home:"Início", feed:"HoopFeed", search:"Pesquisar", alerts:"Alertas", account:"Conta", dashboard:"Painel", directory:"Diretório", teams:"Equipes", coaches:"Treinadores", leagues:"Ligas", membership:"Assinatura", settings:"Configurações", signOut:"Sair", signIn:"Entrar", reviews:"Avaliações", playerDashboard:"PAINEL DO JOGADOR", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Escolha seu idioma", languageDescription:"Escolha o idioma da interface do HoopCheck.", visualMode:"MODO VISUAL", chooseTheme:"Escolha seu tema", darkMode:"Modo escuro", lightMode:"Modo claro", systemMode:"Usar configuração do dispositivo", notifications:"Notificações", basketballAlerts:"Alertas de basquete", motion:"Movimento", mobileInteractions:"Interações fluidas no celular", settingsSaved:"As configurações são salvas automaticamente.", saving:"Salvando…", controlCenter:"CENTRAL DE CONTROLE", findToFollow:"Encontre algo para seguir", playerUsername:"Nome de usuário do jogador", enterUsername:"Digite primeiro o nome de usuário.", finding:"Procurando…", findPlayer:"Encontrar jogador", noPlayer:"Nenhum jogador encontrado com esse nome.", tryAgain:"Não encontramos esse usuário. Tente novamente.", profile:"Perfil", save:"Salvar", cancel:"Cancelar", all:"Todos", teamsDirectory:"Diretório de equipes", searchPlaceholder:"Buscar equipes, treinadores, ligas e jogadores…", noResults:"Nenhum resultado encontrado." },
  it: { home:"Home", feed:"HoopFeed", search:"Cerca", alerts:"Avvisi", account:"Account", dashboard:"Dashboard", directory:"Directory", teams:"Squadre", coaches:"Allenatori", leagues:"Leghe", membership:"Abbonamento", settings:"Impostazioni", signOut:"Esci", signIn:"Accedi", reviews:"Recensioni", playerDashboard:"DASHBOARD DEL GIOCATORE", editProfile:"Modifica profilo", language:"Lingua", chooseLanguage:"Scegli la lingua", languageDescription:"Scegli la lingua dell’interfaccia HoopCheck.", visualMode:"ASPETTO", chooseTheme:"Scegli il tema", darkMode:"Modalità scura", lightMode:"Modalità chiara", systemMode:"Usa impostazioni dispositivo", notifications:"Notifiche", basketballAlerts:"Avvisi basket", motion:"Movimento", mobileInteractions:"Interazioni fluide su mobile", settingsSaved:"Le impostazioni vengono salvate automaticamente.", saving:"Salvataggio…", controlCenter:"CENTRO DI CONTROLLO", findToFollow:"Trova qualcosa da seguire", playerUsername:"Nome utente giocatore", enterUsername:"Inserisci prima il nome utente.", finding:"Ricerca…", findPlayer:"Trova giocatore", noPlayer:"Nessun giocatore trovato con questo nome.", tryAgain:"Utente non trovato. Riprova.", profile:"Profilo", save:"Salva", cancel:"Annulla", all:"Tutti", teamsDirectory:"Directory squadre", searchPlaceholder:"Cerca squadre, allenatori, leghe e giocatori…", noResults:"Nessun risultato trovato." },
  el: { home:"Αρχική", feed:"HoopFeed", search:"Αναζήτηση", alerts:"Ειδοποιήσεις", account:"Λογαριασμός", dashboard:"Πίνακας", directory:"Κατάλογος", teams:"Ομάδες", coaches:"Προπονητές", leagues:"Λίγκες", membership:"Συνδρομή", settings:"Ρυθμίσεις", signOut:"Αποσύνδεση", signIn:"Σύνδεση", reviews:"Κριτικές", playerDashboard:"ΠΙΝΑΚΑΣ ΠΑΙΚΤΗ", editProfile:"Επεξεργασία προφίλ", language:"Γλώσσα", chooseLanguage:"Επιλέξτε γλώσσα", languageDescription:"Επιλέξτε τη γλώσσα διεπαφής του HoopCheck.", visualMode:"ΕΜΦΑΝΙΣΗ", chooseTheme:"Επιλέξτε θέμα", darkMode:"Σκούρα λειτουργία", lightMode:"Ανοιχτή λειτουργία", systemMode:"Χρήση ρύθμισης συσκευής", notifications:"Ειδοποιήσεις", basketballAlerts:"Ειδοποιήσεις μπάσκετ", motion:"Κίνηση", mobileInteractions:"Ομαλές αλληλεπιδράσεις κινητού", settingsSaved:"Οι ρυθμίσεις αποθηκεύονται αυτόματα.", saving:"Αποθήκευση…", controlCenter:"ΚΕΝΤΡΟ ΕΛΕΓΧΟΥ", findToFollow:"Βρείτε κάτι για παρακολούθηση", playerUsername:"Όνομα χρήστη παίκτη", enterUsername:"Εισαγάγετε πρώτα το όνομα χρήστη.", finding:"Αναζήτηση…", findPlayer:"Εύρεση παίκτη", noPlayer:"Δεν βρέθηκε παίκτης με αυτό το όνομα.", tryAgain:"Δεν βρέθηκε αυτό το όνομα. Δοκιμάστε ξανά.", profile:"Προφίλ", save:"Αποθήκευση", cancel:"Ακύρωση", all:"Όλα", teamsDirectory:"Κατάλογος ομάδων", searchPlaceholder:"Αναζήτηση ομάδων, προπονητών, λιγκών, παικτών…", noResults:"Δεν βρέθηκαν αποτελέσματα." },
  ar: { home:"الرئيسية", feed:"HoopFeed", search:"بحث", alerts:"التنبيهات", account:"الحساب", dashboard:"لوحة التحكم", directory:"الدليل", teams:"الفرق", coaches:"المدربون", leagues:"الدوريات", membership:"العضوية", settings:"الإعدادات", signOut:"تسجيل الخروج", signIn:"تسجيل الدخول", reviews:"التقييمات", playerDashboard:"لوحة اللاعب", editProfile:"تعديل الملف الشخصي", language:"اللغة", chooseLanguage:"اختر لغتك", languageDescription:"اختر لغة واجهة HoopCheck.", visualMode:"المظهر", chooseTheme:"اختر المظهر", darkMode:"الوضع الداكن", lightMode:"الوضع الفاتح", systemMode:"استخدام إعداد الجهاز", notifications:"الإشعارات", basketballAlerts:"تنبيهات كرة السلة", motion:"الحركة", mobileInteractions:"تفاعلات سلسة على الهاتف", settingsSaved:"يتم حفظ الإعدادات تلقائيًا.", saving:"جارٍ الحفظ…", controlCenter:"مركز التحكم", findToFollow:"اعثر على شيء لمتابعته", playerUsername:"اسم مستخدم اللاعب", enterUsername:"أدخل اسم المستخدم أولًا.", finding:"جارٍ البحث…", findPlayer:"البحث عن لاعب", noPlayer:"لم يتم العثور على لاعب بهذا الاسم.", tryAgain:"تعذر العثور على اسم المستخدم. حاول مرة أخرى.", profile:"الملف الشخصي", save:"حفظ", cancel:"إلغاء", all:"الكل", teamsDirectory:"دليل الفرق", searchPlaceholder:"ابحث عن الفرق والمدربين والدوريات واللاعبين…", noResults:"لم يتم العثور على نتائج." },
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

function setPreferenceCookie(name: string, value: string) {
  document.cookie = name + "=" + encodeURIComponent(value) + "; Path=/; Max-Age=31536000; SameSite=Lax";
}
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

export default function PreferencesProvider({ children, initialTheme = "system", initialLanguage = "en" }: { children: React.ReactNode; initialTheme?: ThemePreference; initialLanguage?: Language }) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setTheme = useCallback((next: ThemePreference) => {
    if (!validTheme(next)) return;
    setThemeState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-theme", next);
      setPreferenceCookie("hoopcheck-theme", next);
      applyTheme(next);
      window.dispatchEvent(new CustomEvent("hoopcheck-theme-change", { detail: next }));
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from("profiles").update({ theme_preference: next }).eq("id", data.user.id);
      void supabase.from("user_preferences").upsert({ user_id: data.user.id, theme: next, language, notifications_enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    });
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    if (!validLanguage(next)) return;
    setLanguageState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-language", next);
      setPreferenceCookie("hoopcheck-language", next);
      applyLanguage(next);
      window.dispatchEvent(new CustomEvent("hoopcheck-language-change", { detail: next }));
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from("profiles").update({ preferred_language: next }).eq("id", data.user.id);
      void supabase.from("user_preferences").upsert({ user_id: data.user.id, theme, language: next, notifications_enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    });
  }, [theme]);

  useEffect(() => {
    let active = true;
    const storedTheme = localStorage.getItem("hoopcheck-theme");
    const storedLanguage = localStorage.getItem("hoopcheck-language");
    if (validTheme(storedTheme)) { setThemeState(storedTheme); applyTheme(storedTheme); }
    else applyTheme(initialTheme);
    if (validLanguage(storedLanguage)) { setLanguageState(storedLanguage); applyLanguage(storedLanguage); }
    else applyLanguage(initialLanguage);

    const onThemeEvent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (validTheme(value)) { setThemeState(value); localStorage.setItem("hoopcheck-theme", value); setPreferenceCookie("hoopcheck-theme", value); applyTheme(value); }
    };
    const onLanguageEvent = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (validLanguage(value)) { setLanguageState(value); localStorage.setItem("hoopcheck-language", value); setPreferenceCookie("hoopcheck-language", value); applyLanguage(value); }
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemTheme = () => { if ((localStorage.getItem("hoopcheck-theme") || "system") === "system") applyTheme("system"); };
    window.addEventListener("hoopcheck-theme-change", onThemeEvent);
    window.addEventListener("hoopcheck-language-change", onLanguageEvent);
    media.addEventListener?.("change", onSystemTheme);

    const loadProfile = async (userId: string) => {
      const [profileResult, preferencesResult] = await Promise.all([
        supabase.from("profiles").select("theme_preference,preferred_language").eq("id", userId).maybeSingle(),
        supabase.from("user_preferences").select("theme,language").eq("user_id", userId).maybeSingle()
      ]);
      if (!active) return;
      const profile = profileResult.data;
      const prefs = preferencesResult.data;
      const profileTheme = validTheme(profile?.theme_preference) ? profile?.theme_preference : null;
      const prefsTheme = validTheme(prefs?.theme) ? prefs?.theme : null;
      const profileLanguage = validLanguage(profile?.preferred_language) ? profile?.preferred_language : null;
      const prefsLanguage = validLanguage(prefs?.language) ? prefs?.language : null;
      const savedTheme = prefsTheme || profileTheme;
      const savedLanguage = prefsLanguage || profileLanguage;
      if (savedTheme) {
        setThemeState(savedTheme); localStorage.setItem("hoopcheck-theme", savedTheme); setPreferenceCookie("hoopcheck-theme", savedTheme); applyTheme(savedTheme);
      }
      if (savedLanguage) {
        setLanguageState(savedLanguage); localStorage.setItem("hoopcheck-language", savedLanguage); setPreferenceCookie("hoopcheck-language", savedLanguage); applyLanguage(savedLanguage);
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
  }, [initialTheme, initialLanguage]);

  const value = useMemo(() => ({ theme, language, setTheme, setLanguage, t: (key: string) => translations[language][key] || translations.en[key] || key }), [theme, language, setTheme, setLanguage]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
