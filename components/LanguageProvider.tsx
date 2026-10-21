"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type Language = "en" | "es" | "fr" | "de" | "tr" | "pt" | "it" | "el" | "ar";
const locales: Record<Language, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", tr: "tr-TR",
  pt: "pt-PT", it: "it-IT", el: "el-GR", ar: "ar",
};

const labels: Record<Language, Record<string, string>> = {
  en: { dashboard:"Dashboard", search:"Search", membership:"Membership", account:"Account", settings:"Settings", signOut:"Sign Out", playerDashboard:"PLAYER DASHBOARD", reviews:"Reviews", editProfile:"Edit Profile", language:"Language", chooseLanguage:"Choose your language", save:"Save", saving:"Saving…", saved:"Settings saved.", clearFilters:"Clear filters", browseDirectories:"Browse directories", mensTeams:"Men’s Teams", womensTeams:"Women’s Teams", coaches:"Coaches", leagues:"Leagues", players:"Players", resultCount:"results", noResults:"No results found", loading:"Loading…", follow:"Follow", following:"Following", writeReview:"Write a Review", openRosterSpots:"OPEN ROSTER SPOTS", trustScore:"Trust Score", city:"City", country:"Country", league:"League", globalSearch:"Global Search", findTeam:"Don’t see your team?", requestTeam:"Request a team" },
  es: { dashboard:"Panel", search:"Buscar", membership:"Membresía", account:"Cuenta", settings:"Configuración", signOut:"Cerrar sesión", playerDashboard:"PANEL DEL JUGADOR", reviews:"Reseñas", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Elige tu idioma", save:"Guardar", saving:"Guardando…", saved:"Configuración guardada.", clearFilters:"Borrar filtros", browseDirectories:"Explorar directorios", mensTeams:"Equipos masculinos", womensTeams:"Equipos femeninos", coaches:"Entrenadores", leagues:"Ligas", players:"Jugadores", resultCount:"resultados", noResults:"No se encontraron resultados", loading:"Cargando…", follow:"Seguir", following:"Siguiendo", writeReview:"Escribir una reseña", openRosterSpots:"PLAZAS DISPONIBLES", trustScore:"Puntuación de confianza", city:"Ciudad", country:"País", league:"Liga", globalSearch:"Búsqueda global", findTeam:"¿No encuentras tu equipo?", requestTeam:"Solicitar un equipo" },
  fr: { dashboard:"Tableau de bord", search:"Rechercher", membership:"Abonnement", account:"Compte", settings:"Paramètres", signOut:"Déconnexion", playerDashboard:"TABLEAU DE BORD DU JOUEUR", reviews:"Avis", editProfile:"Modifier le profil", language:"Langue", chooseLanguage:"Choisissez votre langue", save:"Enregistrer", saving:"Enregistrement…", saved:"Paramètres enregistrés.", clearFilters:"Effacer les filtres", browseDirectories:"Parcourir les répertoires", mensTeams:"Équipes masculines", womensTeams:"Équipes féminines", coaches:"Entraîneurs", leagues:"Ligues", players:"Joueurs", resultCount:"résultats", noResults:"Aucun résultat", loading:"Chargement…", follow:"Suivre", following:"Abonné", writeReview:"Écrire un avis", openRosterSpots:"PLACES DISPONIBLES", trustScore:"Indice de confiance", city:"Ville", country:"Pays", league:"Ligue", globalSearch:"Recherche globale", findTeam:"Votre équipe manque ?", requestTeam:"Demander une équipe" },
  de: { dashboard:"Dashboard", search:"Suche", membership:"Mitgliedschaft", account:"Konto", settings:"Einstellungen", signOut:"Abmelden", playerDashboard:"SPIELER-DASHBOARD", reviews:"Bewertungen", editProfile:"Profil bearbeiten", language:"Sprache", chooseLanguage:"Sprache auswählen", save:"Speichern", saving:"Speichern…", saved:"Einstellungen gespeichert.", clearFilters:"Filter zurücksetzen", browseDirectories:"Verzeichnisse durchsuchen", mensTeams:"Herrenteams", womensTeams:"Damenteams", coaches:"Trainer", leagues:"Ligen", players:"Spieler", resultCount:"Ergebnisse", noResults:"Keine Ergebnisse gefunden", loading:"Lädt…", follow:"Folgen", following:"Folge ich", writeReview:"Bewertung schreiben", openRosterSpots:"OFFENE KADERPLÄTZE", trustScore:"Vertrauenswert", city:"Stadt", country:"Land", league:"Liga", globalSearch:"Globale Suche", findTeam:"Team nicht gefunden?", requestTeam:"Team anfragen" },
  tr: { dashboard:"Panel", search:"Ara", membership:"Üyelik", account:"Hesap", settings:"Ayarlar", signOut:"Çıkış yap", playerDashboard:"OYUNCU PANELİ", reviews:"Yorumlar", editProfile:"Profili düzenle", language:"Dil", chooseLanguage:"Dilini seç", save:"Kaydet", saving:"Kaydediliyor…", saved:"Ayarlar kaydedildi.", clearFilters:"Filtreleri temizle", browseDirectories:"Dizinlere göz at", mensTeams:"Erkek Takımları", womensTeams:"Kadın Takımları", coaches:"Koçlar", leagues:"Ligler", players:"Oyuncular", resultCount:"sonuç", noResults:"Sonuç bulunamadı", loading:"Yükleniyor…", follow:"Takip et", following:"Takip ediliyor", writeReview:"Yorum yaz", openRosterSpots:"AÇIK KADRO YERLERİ", trustScore:"Güven Puanı", city:"Şehir", country:"Ülke", league:"Lig", globalSearch:"Genel arama", findTeam:"Takımını bulamadın mı?", requestTeam:"Takım talep et" },
  pt: { dashboard:"Painel", search:"Pesquisar", membership:"Assinatura", account:"Conta", settings:"Configurações", signOut:"Sair", playerDashboard:"PAINEL DO JOGADOR", reviews:"Avaliações", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Escolha o idioma", save:"Guardar", saving:"A guardar…", saved:"Definições guardadas.", clearFilters:"Limpar filtros", browseDirectories:"Explorar diretórios", mensTeams:"Equipas masculinas", womensTeams:"Equipas femininas", coaches:"Treinadores", leagues:"Ligas", players:"Jogadores", resultCount:"resultados", noResults:"Nenhum resultado", loading:"A carregar…", follow:"Seguir", following:"A seguir", writeReview:"Escrever avaliação", openRosterSpots:"VAGAS NO PLANTEL", trustScore:"Índice de confiança", city:"Cidade", country:"País", league:"Liga", globalSearch:"Pesquisa global", findTeam:"Não encontra a sua equipa?", requestTeam:"Pedir uma equipa" },
  it: { dashboard:"Dashboard", search:"Cerca", membership:"Abbonamento", account:"Account", settings:"Impostazioni", signOut:"Esci", playerDashboard:"DASHBOARD DEL GIOCATORE", reviews:"Recensioni", editProfile:"Modifica profilo", language:"Lingua", chooseLanguage:"Scegli la lingua", save:"Salva", saving:"Salvataggio…", saved:"Impostazioni salvate.", clearFilters:"Cancella filtri", browseDirectories:"Esplora directory", mensTeams:"Squadre maschili", womensTeams:"Squadre femminili", coaches:"Allenatori", leagues:"Leghe", players:"Giocatori", resultCount:"risultati", noResults:"Nessun risultato", loading:"Caricamento…", follow:"Segui", following:"Seguiti", writeReview:"Scrivi una recensione", openRosterSpots:"POSTI LIBERI IN SQUADRA", trustScore:"Punteggio di fiducia", city:"Città", country:"Paese", league:"Lega", globalSearch:"Ricerca globale", findTeam:"Non trovi la tua squadra?", requestTeam:"Richiedi una squadra" },
  el: { dashboard:"Πίνακας", search:"Αναζήτηση", membership:"Συνδρομή", account:"Λογαριασμός", settings:"Ρυθμίσεις", signOut:"Αποσύνδεση", playerDashboard:"ΠΙΝΑΚΑΣ ΠΑΙΚΤΗ", reviews:"Κριτικές", editProfile:"Επεξεργασία προφίλ", language:"Γλώσσα", chooseLanguage:"Επιλέξτε γλώσσα", save:"Αποθήκευση", saving:"Αποθήκευση…", saved:"Οι ρυθμίσεις αποθηκεύτηκαν.", clearFilters:"Εκκαθάριση φίλτρων", browseDirectories:"Περιήγηση καταλόγων", mensTeams:"Ανδρικές ομάδες", womensTeams:"Γυναικείες ομάδες", coaches:"Προπονητές", leagues:"Πρωταθλήματα", players:"Παίκτες", resultCount:"αποτελέσματα", noResults:"Δεν βρέθηκαν αποτελέσματα", loading:"Φόρτωση…", follow:"Ακολούθηση", following:"Ακολουθείτε", writeReview:"Γράψτε κριτική", openRosterSpots:"ΑΝΟΙΧΤΕΣ ΘΕΣΕΙΣ", trustScore:"Βαθμός εμπιστοσύνης", city:"Πόλη", country:"Χώρα", league:"Πρωτάθλημα", globalSearch:"Καθολική αναζήτηση", findTeam:"Δεν βρίσκετε την ομάδα σας;", requestTeam:"Αίτημα ομάδας" },
  ar: { dashboard:"لوحة التحكم", search:"بحث", membership:"العضوية", account:"الحساب", settings:"الإعدادات", signOut:"تسجيل الخروج", playerDashboard:"لوحة اللاعب", reviews:"التقييمات", editProfile:"تعديل الملف الشخصي", language:"اللغة", chooseLanguage:"اختر لغتك", save:"حفظ", saving:"جارٍ الحفظ…", saved:"تم حفظ الإعدادات.", clearFilters:"مسح عوامل التصفية", browseDirectories:"تصفح الدلائل", mensTeams:"فرق الرجال", womensTeams:"فرق النساء", coaches:"المدربون", leagues:"الدوريات", players:"اللاعبون", resultCount:"النتائج", noResults:"لم يتم العثور على نتائج", loading:"جارٍ التحميل…", follow:"متابعة", following:"تتابع", writeReview:"اكتب مراجعة", openRosterSpots:"أماكن شاغرة في القائمة", trustScore:"درجة الثقة", city:"المدينة", country:"الدولة", league:"الدوري", globalSearch:"بحث شامل", findTeam:"لا تجد فريقك؟", requestTeam:"طلب إضافة فريق" },
};

type LanguageContextValue = {
  language: Language;
  t: (key: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (value: string | number | Date) => string;
  setLanguage: (language: Language) => void;
};
const validLanguage = (value: unknown): value is Language => typeof value === "string" && Object.prototype.hasOwnProperty.call(labels, value);
const initialLanguage = (): Language => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("hoopcheck-language");
  return validLanguage(stored) ? stored : "en";
};
const fallbackContext: LanguageContextValue = {
  language:"en", t:(key)=>labels.en[key] || key,
  formatNumber:(value, options)=>new Intl.NumberFormat("en-US", options).format(value),
  formatDate:(value, options)=>new Intl.DateTimeFormat("en-US", options).format(new Date(value)),
  formatRelativeTime:(value)=>new Intl.RelativeTimeFormat("en-US",{numeric:"auto"}).format(Math.round((new Date(value).getTime()-Date.now())/3600000),"hour"),
  setLanguage:()=>undefined,
};
const LanguageContext = createContext<LanguageContextValue>(fallbackContext);
export function useLanguage() { return useContext(LanguageContext); }

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const setLanguage = (next: Language) => {
    if (!validLanguage(next)) return;
    setLanguageState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-language", next);
      window.dispatchEvent(new CustomEvent("hoopcheck-language-change", { detail: next }));
    }
  };
  useEffect(() => {
    let mounted = true;
    const apply = (value: unknown, persist = true) => {
      if (!mounted || !validLanguage(value)) return;
      setLanguageState(value);
      document.documentElement.lang = value;
      document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
      if (persist) localStorage.setItem("hoopcheck-language", value);
    };
    const onLanguageChange = (event: Event) => apply((event as CustomEvent<Language>).detail);
    window.addEventListener("hoopcheck-language-change", onLanguageChange);
    const loadProfileLanguage = async (userId: string) => {
      const [{ data: profile }, { data: preferences }] = await Promise.all([
        supabase.from("profiles").select("preferred_language").eq("id", userId).maybeSingle(),
        supabase.from("user_preferences").select("language").eq("user_id", userId).maybeSingle(),
      ]);
      if (mounted) apply(profile?.preferred_language || preferences?.language || localStorage.getItem("hoopcheck-language") || "en");
    };
    void supabase.auth.getUser().then(({ data }) => { if (data.user) void loadProfileLanguage(data.user.id); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) void loadProfileLanguage(session.user.id);
    });
    return () => {
      mounted = false;
      window.removeEventListener("hoopcheck-language-change", onLanguageChange);
      listener.subscription.unsubscribe();
    };
  }, []);
  const value = useMemo<LanguageContextValue>(() => {
    const locale = locales[language];
    return {
      language, setLanguage, t: (key) => labels[language][key] || labels.en[key] || key,
      formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
      formatDate: (date, options) => new Intl.DateTimeFormat(locale, options).format(new Date(date)),
      formatRelativeTime: (date) => {
        const deltaSeconds = (new Date(date).getTime() - Date.now()) / 1000;
        const absolute = Math.abs(deltaSeconds);
        const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60],["second",1]];
        const [unit, size] = units.find(([, size]) => absolute >= size) || units[units.length - 1];
        return new Intl.RelativeTimeFormat(locale,{numeric:"auto"}).format(Math.round(deltaSeconds / size),unit);
      },
    };
  }, [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
