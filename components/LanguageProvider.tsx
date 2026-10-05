"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Language = "en"|"es"|"fr"|"de"|"tr"|"pt"|"it"|"el"|"ar";

const labels: Record<Language, Record<string,string>> = {
  en:{dashboard:"Dashboard",search:"Search",membership:"Membership",account:"Account",settings:"Settings",signOut:"Sign Out",playerDashboard:"PLAYER DASHBOARD",reviews:"Reviews",editProfile:"Edit Profile"},
  es:{dashboard:"Panel",search:"Buscar",membership:"Membresía",account:"Cuenta",settings:"Configuración",signOut:"Cerrar sesión",playerDashboard:"PANEL DEL JUGADOR",reviews:"Reseñas",editProfile:"Editar perfil"},
  fr:{dashboard:"Tableau de bord",search:"Rechercher",membership:"Abonnement",account:"Compte",settings:"Paramètres",signOut:"Déconnexion",playerDashboard:"TABLEAU DE BORD DU JOUEUR",reviews:"Avis",editProfile:"Modifier le profil"},
  de:{dashboard:"Dashboard",search:"Suche",membership:"Mitgliedschaft",account:"Konto",settings:"Einstellungen",signOut:"Abmelden",playerDashboard:"SPIELER-DASHBOARD",reviews:"Bewertungen",editProfile:"Profil bearbeiten"},
  tr:{dashboard:"Panel",search:"Ara",membership:"Üyelik",account:"Hesap",settings:"Ayarlar",signOut:"Çıkış yap",playerDashboard:"OYUNCU PANELİ",reviews:"Yorumlar",editProfile:"Profili düzenle"},
  pt:{dashboard:"Painel",search:"Pesquisar",membership:"Assinatura",account:"Conta",settings:"Configurações",signOut:"Sair",playerDashboard:"PAINEL DO JOGADOR",reviews:"Avaliações",editProfile:"Editar perfil"},
  it:{dashboard:"Dashboard",search:"Cerca",membership:"Abbonamento",account:"Account",settings:"Impostazioni",signOut:"Esci",playerDashboard:"DASHBOARD DEL GIOCATORE",reviews:"Recensioni",editProfile:"Modifica profilo"},
  el:{dashboard:"Πίνακας",search:"Αναζήτηση",membership:"Συνδρομή",account:"Λογαριασμός",settings:"Ρυθμίσεις",signOut:"Αποσύνδεση",playerDashboard:"ΠΙΝΑΚΑΣ ΠΑΙΚΤΗ",reviews:"Κριτικές",editProfile:"Επεξεργασία προφίλ"},
  ar:{dashboard:"لوحة التحكم",search:"بحث",membership:"العضوية",account:"الحساب",settings:"الإعدادات",signOut:"تسجيل الخروج",playerDashboard:"لوحة اللاعب",reviews:"التقييمات",editProfile:"تعديل الملف الشخصي"}
};

const LanguageContext=createContext<{language:Language; t:(key:string)=>string}>({language:"en",t:(k)=>k});

export function useLanguage(){ return useContext(LanguageContext); }

export default function LanguageProvider({children}:{children:React.ReactNode}){
  const [language,setLanguage]=useState<Language>("en");
  useEffect(()=>{
    let mounted=true;
    const apply=(v:string)=>{if((Object.keys(labels) as string[]).includes(v)&&mounted){setLanguage(v as Language);document.documentElement.lang=v;document.documentElement.dir=v==="ar"?"rtl":"ltr";}};
    apply(localStorage.getItem("hoopcheck-language")||"en");
    supabase.auth.getUser().then(async({data})=>{
      if(!data.user)return;
      const {data:prefs}=await supabase.from("user_preferences").select("language").eq("user_id",data.user.id).maybeSingle();
      if(prefs?.language) {apply(prefs.language); localStorage.setItem("hoopcheck-language",prefs.language);}
    });
    return()=>{mounted=false};
  },[]);
  return <LanguageContext.Provider value={{language,t:(key)=>labels[language][key]||labels.en[key]||key}}>{children}</LanguageContext.Provider>;
}
