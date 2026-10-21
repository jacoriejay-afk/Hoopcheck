"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type Language = "en" | "es" | "fr" | "de" | "tr" | "pt" | "it" | "el" | "ar";
const locales: Record<Language, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", tr: "tr-TR",
  pt: "pt-PT", it: "it-IT", el: "el-GR", ar: "ar",
};

const labels: Record<Language, Record<string, string>> = {
  en: { dashboard:"Dashboard", search:"Search", membership:"Membership", account:"Account", settings:"Settings", signOut:"Sign Out", playerDashboard:"PLAYER DASHBOARD", reviews:"Reviews", editProfile:"Edit Profile", language:"Language", chooseLanguage:"Choose your language", save:"Save", saving:"Saving…", saved:"Settings saved.", clearFilters:"Clear filters", browseDirectories:"Browse directories", mensTeams:"Men’s Teams", womensTeams:"Women’s Teams", coaches:"Coaches", leagues:"Leagues", players:"Players", resultCount:"results", noResults:"No results found", loading:"Loading…", follow:"Follow", following:"Following", writeReview:"Write a Review", openRosterSpots:"OPEN ROSTER SPOTS", trustScore:"Trust Score", city:"City", country:"Country", league:"League", globalSearch:"Global Search", findTeam:"Don’t see your team?", requestTeam:"Request a team" ,directoryKicker:"HOOPCHECK DIRECTORY",teamsDirectoryTitle:"Know the organization before you sign.",teamsDirectoryDescription:"Explore professional basketball organizations and learn from players who have already experienced them.",womensDirectoryTitle:"Find a women’s team",womensDirectoryDescription:"Search professional women’s teams by club, league, city, or country.",coachesDirectoryTitle:"Know the coach before you sign.",coachesDirectoryDescription:"Research coaches through real player experiences from professional basketball around the world.",leaguesDirectoryTitle:"Know the league before you commit.",leaguesDirectoryDescription:"Explore professional basketball leagues and learn from players who have already experienced them.",playersDirectoryTitle:"Find players",playersDirectoryDescription:"Research professional players, follow talent, and discover basketball experience across the global game."},
  es: { dashboard:"Panel", search:"Buscar", membership:"Membresía", account:"Cuenta", settings:"Configuración", signOut:"Cerrar sesión", playerDashboard:"PANEL DEL JUGADOR", reviews:"Reseñas", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Elige tu idioma", save:"Guardar", saving:"Guardando…", saved:"Configuración guardada.", clearFilters:"Borrar filtros", browseDirectories:"Explorar directorios", mensTeams:"Equipos masculinos", womensTeams:"Equipos femeninos", coaches:"Entrenadores", leagues:"Ligas", players:"Jugadores", resultCount:"resultados", noResults:"No se encontraron resultados", loading:"Cargando…", follow:"Seguir", following:"Siguiendo", writeReview:"Escribir una reseña", openRosterSpots:"PLAZAS DISPONIBLES", trustScore:"Puntuación de confianza", city:"Ciudad", country:"País", league:"Liga", globalSearch:"Búsqueda global", findTeam:"¿No encuentras tu equipo?", requestTeam:"Solicitar un equipo" ,directoryKicker:"DIRECTORIO HOOPCHECK",teamsDirectoryTitle:"Conoce al equipo antes de firmar.",teamsDirectoryDescription:"Explora equipos profesionales y aprende de jugadores que ya han vivido la experiencia.",womensDirectoryTitle:"Encuentra un equipo femenino",womensDirectoryDescription:"Busca equipos femeninos profesionales por club, liga, ciudad o país.",coachesDirectoryTitle:"Conoce al entrenador antes de firmar.",coachesDirectoryDescription:"Investiga entrenadores a través de experiencias reales de jugadores profesionales.",leaguesDirectoryTitle:"Conoce la liga antes de comprometerte.",leaguesDirectoryDescription:"Explora ligas profesionales y aprende de jugadores que ya han jugado en ellas.",playersDirectoryTitle:"Encuentra jugadores",playersDirectoryDescription:"Investiga jugadores profesionales, sigue talentos y descubre experiencias del baloncesto mundial."},
  fr: { dashboard:"Tableau de bord", search:"Rechercher", membership:"Abonnement", account:"Compte", settings:"Paramètres", signOut:"Déconnexion", playerDashboard:"TABLEAU DE BORD DU JOUEUR", reviews:"Avis", editProfile:"Modifier le profil", language:"Langue", chooseLanguage:"Choisissez votre langue", save:"Enregistrer", saving:"Enregistrement…", saved:"Paramètres enregistrés.", clearFilters:"Effacer les filtres", browseDirectories:"Parcourir les répertoires", mensTeams:"Équipes masculines", womensTeams:"Équipes féminines", coaches:"Entraîneurs", leagues:"Ligues", players:"Joueurs", resultCount:"résultats", noResults:"Aucun résultat", loading:"Chargement…", follow:"Suivre", following:"Abonné", writeReview:"Écrire un avis", openRosterSpots:"PLACES DISPONIBLES", trustScore:"Indice de confiance", city:"Ville", country:"Pays", league:"Ligue", globalSearch:"Recherche globale", findTeam:"Votre équipe manque ?", requestTeam:"Demander une équipe" ,directoryKicker:"ANNUAIRE HOOPCHECK",teamsDirectoryTitle:"Connaissez le club avant de signer.",teamsDirectoryDescription:"Explorez les clubs professionnels et découvrez les expériences des joueurs qui y ont évolué.",womensDirectoryTitle:"Trouver une équipe féminine",womensDirectoryDescription:"Recherchez des équipes féminines professionnelles par club, ligue, ville ou pays.",coachesDirectoryTitle:"Connaissez l’entraîneur avant de signer.",coachesDirectoryDescription:"Évaluez les entraîneurs grâce aux expériences réelles de joueurs professionnels.",leaguesDirectoryTitle:"Connaissez la ligue avant de vous engager.",leaguesDirectoryDescription:"Explorez les ligues professionnelles et les expériences des joueurs qui y ont évolué.",playersDirectoryTitle:"Trouver des joueurs",playersDirectoryDescription:"Découvrez les joueurs professionnels, suivez les talents et explorez le basket mondial."},
  de: { dashboard:"Dashboard", search:"Suche", membership:"Mitgliedschaft", account:"Konto", settings:"Einstellungen", signOut:"Abmelden", playerDashboard:"SPIELER-DASHBOARD", reviews:"Bewertungen", editProfile:"Profil bearbeiten", language:"Sprache", chooseLanguage:"Sprache auswählen", save:"Speichern", saving:"Speichern…", saved:"Einstellungen gespeichert.", clearFilters:"Filter zurücksetzen", browseDirectories:"Verzeichnisse durchsuchen", mensTeams:"Herrenteams", womensTeams:"Damenteams", coaches:"Trainer", leagues:"Ligen", players:"Spieler", resultCount:"Ergebnisse", noResults:"Keine Ergebnisse gefunden", loading:"Lädt…", follow:"Folgen", following:"Folge ich", writeReview:"Bewertung schreiben", openRosterSpots:"OFFENE KADERPLÄTZE", trustScore:"Vertrauenswert", city:"Stadt", country:"Land", league:"Liga", globalSearch:"Globale Suche", findTeam:"Team nicht gefunden?", requestTeam:"Team anfragen" ,directoryKicker:"HOOPCHECK-VERZEICHNIS",teamsDirectoryTitle:"Lerne den Verein kennen, bevor du unterschreibst.",teamsDirectoryDescription:"Entdecke Profivereine und erfahre von Spielern, die bereits dort gespielt haben.",womensDirectoryTitle:"Finde ein Frauenteam",womensDirectoryDescription:"Suche professionelle Frauenteams nach Verein, Liga, Stadt oder Land.",coachesDirectoryTitle:"Lerne den Trainer kennen, bevor du unterschreibst.",coachesDirectoryDescription:"Informiere dich anhand echter Erfahrungen von Profispielern über Trainer.",leaguesDirectoryTitle:"Lerne die Liga kennen, bevor du dich entscheidest.",leaguesDirectoryDescription:"Entdecke Profiligen und Erfahrungen von Spielern, die bereits dort gespielt haben.",playersDirectoryTitle:"Spieler finden",playersDirectoryDescription:"Recherchiere Profispieler, entdecke Talente und lerne den internationalen Basketball kennen."},
  tr: { dashboard:"Panel", search:"Ara", membership:"Üyelik", account:"Hesap", settings:"Ayarlar", signOut:"Çıkış yap", playerDashboard:"OYUNCU PANELİ", reviews:"Yorumlar", editProfile:"Profili düzenle", language:"Dil", chooseLanguage:"Dilini seç", save:"Kaydet", saving:"Kaydediliyor…", saved:"Ayarlar kaydedildi.", clearFilters:"Filtreleri temizle", browseDirectories:"Dizinlere göz at", mensTeams:"Erkek Takımları", womensTeams:"Kadın Takımları", coaches:"Koçlar", leagues:"Ligler", players:"Oyuncular", resultCount:"sonuç", noResults:"Sonuç bulunamadı", loading:"Yükleniyor…", follow:"Takip et", following:"Takip ediliyor", writeReview:"Yorum yaz", openRosterSpots:"AÇIK KADRO YERLERİ", trustScore:"Güven Puanı", city:"Şehir", country:"Ülke", league:"Lig", globalSearch:"Genel arama", findTeam:"Takımını bulamadın mı?", requestTeam:"Takım talep et" ,directoryKicker:"HOOPCHECK DİZİNİ",teamsDirectoryTitle:"İmzalamadan önce takımı tanı.",teamsDirectoryDescription:"Profesyonel takımları keşfet ve orada oynamış oyuncuların deneyimlerini öğren.",womensDirectoryTitle:"Kadın takımı bul",womensDirectoryDescription:"Profesyonel kadın takımlarını kulüp, lig, şehir veya ülkeye göre ara.",coachesDirectoryTitle:"İmzalamadan önce koçu tanı.",coachesDirectoryDescription:"Koçları profesyonel oyuncuların gerçek deneyimleriyle araştır.",leaguesDirectoryTitle:"Karar vermeden önce ligi tanı.",leaguesDirectoryDescription:"Profesyonel ligleri ve bu liglerde oynamış oyuncuların deneyimlerini keşfet.",playersDirectoryTitle:"Oyuncu bul",playersDirectoryDescription:"Profesyonel oyuncuları araştır, yetenekleri takip et ve dünya basketbolunu keşfet."},
  pt: { dashboard:"Painel", search:"Pesquisar", membership:"Assinatura", account:"Conta", settings:"Configurações", signOut:"Sair", playerDashboard:"PAINEL DO JOGADOR", reviews:"Avaliações", editProfile:"Editar perfil", language:"Idioma", chooseLanguage:"Escolha o idioma", save:"Guardar", saving:"A guardar…", saved:"Definições guardadas.", clearFilters:"Limpar filtros", browseDirectories:"Explorar diretórios", mensTeams:"Equipas masculinas", womensTeams:"Equipas femininas", coaches:"Treinadores", leagues:"Ligas", players:"Jogadores", resultCount:"resultados", noResults:"Nenhum resultado", loading:"A carregar…", follow:"Seguir", following:"A seguir", writeReview:"Escrever avaliação", openRosterSpots:"VAGAS NO PLANTEL", trustScore:"Índice de confiança", city:"Cidade", country:"País", league:"Liga", globalSearch:"Pesquisa global", findTeam:"Não encontra a sua equipa?", requestTeam:"Pedir uma equipa" ,directoryKicker:"DIRETÓRIO HOOPCHECK",teamsDirectoryTitle:"Conheça a equipa antes de assinar.",teamsDirectoryDescription:"Explore equipas profissionais e conheça as experiências de quem já jogou nelas.",womensDirectoryTitle:"Encontrar uma equipa feminina",womensDirectoryDescription:"Pesquise equipas femininas profissionais por clube, liga, cidade ou país.",coachesDirectoryTitle:"Conheça o treinador antes de assinar.",coachesDirectoryDescription:"Pesquise treinadores através das experiências reais de jogadores profissionais.",leaguesDirectoryTitle:"Conheça a liga antes de decidir.",leaguesDirectoryDescription:"Explore ligas profissionais e as experiências de jogadores que já competiram nelas.",playersDirectoryTitle:"Encontrar jogadores",playersDirectoryDescription:"Pesquise jogadores profissionais, acompanhe talentos e descubra o basquetebol mundial."},
  it: { dashboard:"Dashboard", search:"Cerca", membership:"Abbonamento", account:"Account", settings:"Impostazioni", signOut:"Esci", playerDashboard:"DASHBOARD DEL GIOCATORE", reviews:"Recensioni", editProfile:"Modifica profilo", language:"Lingua", chooseLanguage:"Scegli la lingua", save:"Salva", saving:"Salvataggio…", saved:"Impostazioni salvate.", clearFilters:"Cancella filtri", browseDirectories:"Esplora directory", mensTeams:"Squadre maschili", womensTeams:"Squadre femminili", coaches:"Allenatori", leagues:"Leghe", players:"Giocatori", resultCount:"risultati", noResults:"Nessun risultato", loading:"Caricamento…", follow:"Segui", following:"Seguiti", writeReview:"Scrivi una recensione", openRosterSpots:"POSTI LIBERI IN SQUADRA", trustScore:"Punteggio di fiducia", city:"Città", country:"Paese", league:"Lega", globalSearch:"Ricerca globale", findTeam:"Non trovi la tua squadra?", requestTeam:"Richiedi una squadra" ,directoryKicker:"ELENCO HOOPCHECK",teamsDirectoryTitle:"Conosci la squadra prima di firmare.",teamsDirectoryDescription:"Esplora le squadre professionistiche e scopri le esperienze di chi ci ha già giocato.",womensDirectoryTitle:"Trova una squadra femminile",womensDirectoryDescription:"Cerca squadre femminili professionistiche per club, lega, città o paese.",coachesDirectoryTitle:"Conosci l’allenatore prima di firmare.",coachesDirectoryDescription:"Valuta gli allenatori attraverso le esperienze reali dei giocatori professionisti.",leaguesDirectoryTitle:"Conosci la lega prima di decidere.",leaguesDirectoryDescription:"Esplora le leghe professionistiche e le esperienze di chi ci ha già giocato.",playersDirectoryTitle:"Trova giocatori",playersDirectoryDescription:"Cerca giocatori professionisti, segui i talenti e scopri il basket internazionale."},
  el: { dashboard:"Πίνακας", search:"Αναζήτηση", membership:"Συνδρομή", account:"Λογαριασμός", settings:"Ρυθμίσεις", signOut:"Αποσύνδεση", playerDashboard:"ΠΙΝΑΚΑΣ ΠΑΙΚΤΗ", reviews:"Κριτικές", editProfile:"Επεξεργασία προφίλ", language:"Γλώσσα", chooseLanguage:"Επιλέξτε γλώσσα", save:"Αποθήκευση", saving:"Αποθήκευση…", saved:"Οι ρυθμίσεις αποθηκεύτηκαν.", clearFilters:"Εκκαθάριση φίλτρων", browseDirectories:"Περιήγηση καταλόγων", mensTeams:"Ανδρικές ομάδες", womensTeams:"Γυναικείες ομάδες", coaches:"Προπονητές", leagues:"Πρωταθλήματα", players:"Παίκτες", resultCount:"αποτελέσματα", noResults:"Δεν βρέθηκαν αποτελέσματα", loading:"Φόρτωση…", follow:"Ακολούθηση", following:"Ακολουθείτε", writeReview:"Γράψτε κριτική", openRosterSpots:"ΑΝΟΙΧΤΕΣ ΘΕΣΕΙΣ", trustScore:"Βαθμός εμπιστοσύνης", city:"Πόλη", country:"Χώρα", league:"Πρωτάθλημα", globalSearch:"Καθολική αναζήτηση", findTeam:"Δεν βρίσκετε την ομάδα σας;", requestTeam:"Αίτημα ομάδας" ,directoryKicker:"ΚΑΤΑΛΟΓΟΣ HOOPCHECK",teamsDirectoryTitle:"Γνώρισε την ομάδα πριν υπογράψεις.",teamsDirectoryDescription:"Εξερεύνησε επαγγελματικές ομάδες και μάθε από παίκτες που έχουν ήδη αγωνιστεί εκεί.",womensDirectoryTitle:"Βρες γυναικεία ομάδα",womensDirectoryDescription:"Αναζήτησε επαγγελματικές γυναικείες ομάδες ανά σύλλογο, πρωτάθλημα, πόλη ή χώρα.",coachesDirectoryTitle:"Γνώρισε τον προπονητή πριν υπογράψεις.",coachesDirectoryDescription:"Μάθε για προπονητές μέσα από πραγματικές εμπειρίες επαγγελματιών παικτών.",leaguesDirectoryTitle:"Γνώρισε το πρωτάθλημα πριν αποφασίσεις.",leaguesDirectoryDescription:"Εξερεύνησε επαγγελματικά πρωταθλήματα και εμπειρίες παικτών που έχουν αγωνιστεί εκεί.",playersDirectoryTitle:"Βρες παίκτες",playersDirectoryDescription:"Ερεύνησε επαγγελματίες παίκτες, ανακάλυψε ταλέντα και γνώρισε το παγκόσμιο μπάσκετ."},
  ar: { dashboard:"لوحة التحكم", search:"بحث", membership:"العضوية", account:"الحساب", settings:"الإعدادات", signOut:"تسجيل الخروج", playerDashboard:"لوحة اللاعب", reviews:"التقييمات", editProfile:"تعديل الملف الشخصي", language:"اللغة", chooseLanguage:"اختر لغتك", save:"حفظ", saving:"جارٍ الحفظ…", saved:"تم حفظ الإعدادات.", clearFilters:"مسح عوامل التصفية", browseDirectories:"تصفح الدلائل", mensTeams:"فرق الرجال", womensTeams:"فرق النساء", coaches:"المدربون", leagues:"الدوريات", players:"اللاعبون", resultCount:"النتائج", noResults:"لم يتم العثور على نتائج", loading:"جارٍ التحميل…", follow:"متابعة", following:"تتابع", writeReview:"اكتب مراجعة", openRosterSpots:"أماكن شاغرة في القائمة", trustScore:"درجة الثقة", city:"المدينة", country:"الدولة", league:"الدوري", globalSearch:"بحث شامل", findTeam:"لا تجد فريقك؟", requestTeam:"طلب إضافة فريق" ,directoryKicker:"دليل هوب تشيك",teamsDirectoryTitle:"تعرّف على الفريق قبل التوقيع.",teamsDirectoryDescription:"استكشف فرق كرة السلة المحترفة وتعرّف على تجارب اللاعبين الذين لعبوا معها.",womensDirectoryTitle:"ابحث عن فريق نسائي",womensDirectoryDescription:"ابحث عن فرق كرة السلة النسائية المحترفة حسب النادي أو الدوري أو المدينة أو الدولة.",coachesDirectoryTitle:"تعرّف على المدرب قبل التوقيع.",coachesDirectoryDescription:"ابحث عن معلومات المدربين من خلال تجارب اللاعبين المحترفين الفعلية.",leaguesDirectoryTitle:"تعرّف على الدوري قبل الالتزام.",leaguesDirectoryDescription:"استكشف الدوريات المحترفة وتجارب اللاعبين الذين شاركوا فيها.",playersDirectoryTitle:"ابحث عن لاعبين",playersDirectoryDescription:"ابحث عن لاعبي كرة السلة المحترفين وتابع المواهب واكتشف تجارب اللعبة عالميًا."},
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

const fallbackContext: LanguageContextValue = {
  language:"en", t:(key)=>labels.en[key] || key,
  formatNumber:(value, options)=>new Intl.NumberFormat("en-US", options).format(value),
  formatDate:(value, options)=>new Intl.DateTimeFormat("en-US", options).format(new Date(value)),
  formatRelativeTime:(value)=>new Intl.RelativeTimeFormat("en-US",{numeric:"auto"}).format(Math.round((new Date(value).getTime()-Date.now())/3600000),"hour"),
  setLanguage:()=>undefined,
};
const LanguageContext = createContext<LanguageContextValue>(fallbackContext);
export function useLanguage() { return useContext(LanguageContext); }

export default function LanguageProvider({ children, initialLanguage = "en" }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(validLanguage(initialLanguage) ? initialLanguage : "en");
  const setLanguage = (next: Language) => {
    if (!validLanguage(next)) return;
    setLanguageState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("hoopcheck-language", next);
      document.cookie = "hoopcheck-language=" + encodeURIComponent(next) + "; Path=/; Max-Age=31536000; SameSite=Lax";
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
      if (persist) {
        localStorage.setItem("hoopcheck-language", value);
        document.cookie = "hoopcheck-language=" + encodeURIComponent(value) + "; Path=/; Max-Age=31536000; SameSite=Lax";
      }
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
