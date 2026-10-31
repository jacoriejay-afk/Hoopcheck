"use client";

import { useEffect, useState } from "react";
import { HoopIcon, VerifiedBadge } from "../../components/HoopCheckUI";
import Link from "next/link";
import HoopLoading from "../../components/HoopLoading";
import { supabase } from "../../lib/supabase";
import ThemeToast from "../../components/ThemeToast";
import Surface from "../../components/Surface";
import { useTheme } from "../../components/ThemeProvider";
import { useLanguage, type Language } from "../../components/LanguageProvider";

type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type Profile = {
  account_type: "player"|"coach"|"scout"|"agent"|"fan";
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  professional_experience: boolean;
  bio: string | null;
  position: string | null;
  years_pro: number | null;
  current_country: string | null;
  current_country_public: boolean;
  current_team: string | null;
  profile_visibility: "public" | "private" | "players_only";
  player_verified: boolean; coach_verified?: boolean; coach_profile_id?: string | null; experience_summary?: string | null;
  profile_claimed: boolean;
  avatar_url: string | null;
  avatar_moderation_status: "pending" | "approved" | "rejected";
};
type Review = { id: string; status: string; title: string | null; body: string; overall_rating: number; created_at: string; coach_id: string | null; team_id: string | null; league_id: string | null; };
type Target = { id: string; name: string };

const emptyProfile: Profile = {
  account_type: "player",
  display_name: null, first_name: null, last_name: null, professional_experience: false,
  bio: null, position: null, years_pro: null, current_country: null, current_country_public: true, current_team: null,
  profile_visibility: "public", player_verified: false, profile_claimed: true,
  avatar_url: null, avatar_moderation_status: "approved"
};

function SettingsGlyph({name}:{name:string}) {
  const paths:Record<string,string>={user:"M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10",mail:"M4 5h16v14H4z M4 7l8 6 8-6",lock:"M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3",crown:"M2 7l5 4 5-8 5 8 5-4-2 13H4z",moon:"M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z",globe:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20",message:"M21 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.2A8.5 8.5 0 1 1 21 11.5z", "user-plus":"M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8v6 M16 11h6",star:"m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",activity:"M3 12h4l3-8 4 16 3-8h4", "map-pin":"M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4",eye:"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",help:"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",headphones:"M3 14v-3a9 9 0 0 1 18 0v3 M3 14h4v7H5a2 2 0 0 1-2-2z M21 14h-4v7h2a2 2 0 0 0 2-2z",file:"M14 2H6v20h12V8z M14 2v6h6 M9 13h6 M9 17h6",shield:"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z M9 12l2 2 4-4",logout:"M10 17l5-5-5-5 M15 12H3 M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7",trash:"M3 6h18 M8 6V4h8v2 M19 6l-1 15H6L5 6 M10 11v6 M14 11v6"};
  return <span className="hc-setting-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.user}/></svg></span>;
}
function SettingsGroup({title,children,danger=false}:{title:string;children:React.ReactNode;danger?:boolean}) {
 return <section className={"hc-settings-group"+(danger?" is-danger":"")}><h3>{title}</h3><div className="hc-settings-list">{children}</div></section>;
}
function SettingsRow({icon,label,value,href,onClick,danger=false}:{icon:string;label:string;value:string;href?:string;onClick?:()=>void;danger?:boolean}) {
 const content=<><SettingsGlyph name={icon}/><span className="hc-setting-copy"><strong>{label}</strong></span><span className="hc-setting-value">{value}</span><span className="hc-setting-chevron" aria-hidden="true">›</span></>;
 if(href)return <Link className={"hc-setting-row"+(danger?" is-danger":"")} href={href}>{content}</Link>;
 return <button type="button" className={"hc-setting-row"+(danger?" is-danger":"")} onClick={onClick}>{content}</button>;
}
function SettingsToggle({icon,label,checked,onChange}:{icon:string;label:string;checked:boolean;onChange:(value:boolean)=>void}) {
 return <div className="hc-setting-row"><SettingsGlyph name={icon}/><span className="hc-setting-copy"><strong>{label}</strong></span><button type="button" role="switch" aria-checked={checked} className={"hc-switch"+(checked?" is-on":"")} onClick={()=>onChange(!checked)}><span/></button></div>;
}

export default function AccountPage() {
  const { setTheme: setGlobalTheme } = useTheme();
  const { t, setLanguage: applyLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [verified, setVerified] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [position, setPosition] = useState("");
  const [yearsPro, setYearsPro] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [countryPublic, setCountryPublic] = useState(false);
  const [currentTeam, setCurrentTeam] = useState("");
  const [hometown, setHometown] = useState("");
  const [nationality, setNationality] = useState("");
  const [interests, setInterests] = useState("");
  const [favoriteLeagues, setFavoriteLeagues] = useState("");
  const [coachingExperience, setCoachingExperience] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [freeAgent, setFreeAgent] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState<"pending"|"approved"|"rejected">("approved");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [themePreference, setThemePreference] = useState<"system"|"light"|"dark">("system");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [notificationPreferences, setNotificationPreferences] = useState({game_chat_alerts:true,new_follower:true,team_reviews:true,hoopfeed_activity:true});
  const [settingsVisibility, setSettingsVisibility] = useState<"public"|"players_only">("public");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setEmail(user.email ?? "");
      setUserId(user.id);
      const [{ data: profileData }, { data: subscriptionData }] = await Promise.all([
        supabase.from("profiles").select("account_type,display_name,first_name,last_name,professional_experience,bio,position,years_pro,current_country,current_country_public,current_team,profile_visibility,player_verified,coach_verified,coach_profile_id,experience_summary,profile_claimed,avatar_url,avatar_moderation_status").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,current_period_end,cancel_at_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      const nextProfile: Profile = profileData
        ? { ...emptyProfile, ...profileData }
        : emptyProfile;
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name ?? "");
      setBio(nextProfile.bio ?? "");
      setPosition(nextProfile.position ?? "");
      setYearsPro(nextProfile.years_pro?.toString() ?? "");
      setCurrentCountry(nextProfile.current_country ?? "");
      setCountryPublic(Boolean(nextProfile.current_country_public));
      setCurrentTeam(nextProfile.current_team ?? "");
      setHometown((nextProfile as any).hometown ?? "");
      setNationality((nextProfile as any).nationality ?? "");
      setFreeAgent(Boolean((nextProfile as any).free_agent));
      setInterests((nextProfile as any).interests ?? "");
      setFavoriteLeagues((nextProfile as any).favorite_leagues ?? "");
      setCoachingExperience((nextProfile as any).experience_summary ?? "");
      setVisibility(nextProfile.profile_visibility === "private" ? "private" : "public");
      setAvatarUrl(nextProfile.avatar_url ?? "");
      setAvatarStatus(nextProfile.avatar_moderation_status ?? "approved");
      setSubscription(subscriptionData ?? null);
      setVerified(Boolean(nextProfile.player_verified || (nextProfile as any).coach_verified));
      const { data } = await supabase.from("reviews")
        .select("id,status,title,body,overall_rating,created_at,coach_id,team_id,league_id")
        .eq("author_id", user.id).order("created_at", { ascending: false });
      const rows = data ?? [];
      setReviews(rows);
      const ids = {
        coaches: rows.flatMap(r => r.coach_id ? [r.coach_id] : []),
        teams: rows.flatMap(r => r.team_id ? [r.team_id] : []),
        leagues: rows.flatMap(r => r.league_id ? [r.league_id] : [])
      };
      const [c,t,l] = await Promise.all([
        ids.coaches.length ? supabase.from("coaches").select("id,name").in("id", ids.coaches) : Promise.resolve({data:[]}),
        ids.teams.length ? supabase.from("teams").select("id,name").in("id", ids.teams) : Promise.resolve({data:[]}),
        ids.leagues.length ? supabase.from("leagues").select("id,name").in("id", ids.leagues) : Promise.resolve({data:[]})
      ]);
      const map: Record<string, Target> = {};
      for (const x of [...(c.data ?? []), ...(t.data ?? []), ...(l.data ?? [])]) map[x.id] = x;
      setTargets(map); setLoading(false);
    }
    load();
  }, []);

  function chooseAvatar(file: File) {
    if (!file.type.startsWith("image/")) { setProfileMessage(t("chooseImageFile")); return; }
    if (file.size > 10 * 1024 * 1024) { setProfileMessage(t("photoMaxSize")); return; }
    setCropFile(file);
    setCropPreview(URL.createObjectURL(file));
    setCropZoom(1);
    setProfileMessage("");
  }

  async function cropAndUploadAvatar() {
    if (!cropFile || !cropPreview) return;
    const image = new Image();
    image.src = cropPreview;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read that image."));
    });

    const size = 720;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setProfileMessage(t("photoPrepareFailed")); return; }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / cropZoom;
    const sx = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sy = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setProfileMessage(t("cropPrepareFailed")); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = user.id + "/avatar-" + Date.now() + ".jpg";
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, blob, { upsert: false, contentType: "image/jpeg", cacheControl: "31536000" });
    if (uploadError) { setProfileMessage(uploadError.message); return; }

    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
    const pendingUrl = data.publicUrl + "?v=" + Date.now();
    const { error } = await supabase.from("profiles").update({ avatar_url: pendingUrl, avatar_moderation_status: "approved" }).eq("id", user.id);
    if (error) { setProfileMessage(error.message); return; }

    setAvatarUrl(pendingUrl);
    setAvatarStatus("approved");
    setCropFile(null);
    setCropPreview("");
    setProfileMessage(t("photoUploaded"));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    const name = displayName.trim().slice(0, 80);
    const years = yearsPro.trim() ? Number(yearsPro) : null;
    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 50)) {
      setProfileMessage(t("yearsProRangeError"));
      setSavingProfile(false);
      return;
    }
    const updates = {
      display_name: name || null, bio: bio.trim().slice(0, 500) || null,
      position: profile.account_type === "player" ? position.trim().slice(0, 40) || null : profile.position,
      years_pro: years,
      current_country: currentCountry.trim().slice(0, 80) || null,
      current_country_public: profile.account_type === "player" ? countryPublic : false,
      current_team: currentTeam.trim().slice(0, 120) || null,
      hometown: hometown.trim().slice(0,120) || null,
      nationality: nationality.trim().slice(0,80) || null,
      interests: interests.trim().slice(0,500) || null,
      favorite_leagues: favoriteLeagues.trim().slice(0,500) || null,
      experience_summary: profile.account_type === "coach" ? coachingExperience.trim().slice(0,1000) || null : null,
      profile_visibility: ["scout","agent","fan"].includes(profile.account_type) ? settingsVisibility : (visibility === "private" ? "players_only" : "public"),
      free_agent: profile.account_type === "player" ? freeAgent : false,
    };
    const { error } = await supabase.from("profiles").update(updates).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    if (error) setProfileMessage(error.message);
    else {
      setProfile((current) => ({ ...current, ...updates }));
      setDisplayName(name); setProfileMessage(t("profileUpdated"));
    }
    setSavingProfile(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) { setProfileMessage(t("signOutFailed")); return; }
    window.location.replace("/login");
  }

  async function deleteAccountConfirmed() {
    setDeletingAccount(true); setProfileMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || t("deleteAccountFailed"));
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace("/?account_deleted=true");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : t("deleteAccountFailed"));
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from("profiles").select("theme_preference,preferred_language,notification_preferences,profile_visibility,current_country_public").eq("id", userId).maybeSingle();
      if (!alive || !data) return;
      const theme = ["system","light","dark"].includes(data.theme_preference) ? data.theme_preference as "system"|"light"|"dark" : "system";
      const localTheme = localStorage.getItem("hoopcheck-theme");
      const cookieHasTheme = document.cookie.split(";").some((item) => item.trim().startsWith("hoopcheck-theme="));
      setThemePreference(localTheme && ["system","light","dark"].includes(localTheme) ? localTheme as "system"|"light"|"dark" : theme);
      if (!localTheme && !cookieHasTheme) setGlobalTheme(theme);
      const supportedLanguages: Language[] = ["en","es","fr","de","tr","pt","it","el","ar","ru","az","pl","zh","ja","sr","fi","he","lt","uk"];
      const language = supportedLanguages.includes(data.preferred_language as Language) ? data.preferred_language as Language : "en";
      setPreferredLanguage(language);
      localStorage.setItem("hoopcheck-language", language);
      applyLanguage(language);
      const notifications = data.notification_preferences && typeof data.notification_preferences === "object" ? data.notification_preferences as Record<string, unknown> : {};
      setNotificationPreferences({
        game_chat_alerts: notifications.game_chat_alerts !== false,
        new_follower: notifications.new_follower !== false,
        team_reviews: notifications.team_reviews !== false,
        hoopfeed_activity: notifications.hoopfeed_activity !== false
      });
      setSettingsVisibility(data.profile_visibility === "public" ? "public" : "players_only");
      setCountryPublic(Boolean(data.current_country_public));
    })();
    return () => { alive = false; };
  }, [userId, setGlobalTheme, applyLanguage]);

  async function saveSetting(values: Record<string, unknown>, success: string) {
    setSettingsMessage("");
    const { error } = await supabase.from("profiles").update(values).eq("id", userId);
    if (error) { setSettingsMessage(t("saveSettingFailed") + error.message); return false; }
    setSettingsMessage(success);
    return true;
  }

  async function changeTheme(next: "system"|"light"|"dark") {
    setThemePreference(next);
    localStorage.setItem("hoopcheck-theme", next);
    setGlobalTheme(next);
    await saveSetting({ theme_preference: next }, "Appearance saved.");
  }

  async function changeLanguage(next: string) {
    const supportedLanguages: Language[] = ["en","es","fr","de","tr","pt","it","el","ar","ru","az","pl","zh","ja","sr","fi","he","lt","uk"];
    if (!supportedLanguages.includes(next as Language)) return;
    const language = next as Language;
    setPreferredLanguage(language);
    applyLanguage(language); // Update the root provider immediately so mounted screens re-render.
    await saveSetting({ preferred_language: language }, t("languageSaved"));
  }

  async function changeNotification(key: keyof typeof notificationPreferences, checked: boolean) {
    const next = { ...notificationPreferences, [key]: checked };
    setNotificationPreferences(next);
    await saveSetting({ notification_preferences: next }, t("notificationPreferencesSaved"));
  }

  async function changeEmail() {
    const next = window.prompt(t("enterNewEmail"), email)?.trim();
    if (!next || next === email) return;
    const { error } = await supabase.auth.updateUser({ email: next });
    if (error) setSettingsMessage(t("couldNotUpdateEmail") + error.message);
    else setSettingsMessage(t("confirmEmailChange"));
  }

  async function submitPasswordChange() {
    setPasswordMessage("");
    if (newPassword.length < 8) { setPasswordMessage(t("useAtLeast8Characters")); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPasswordMessage(error.message); return; }
    setNewPassword(""); setPasswordModal(false); setSettingsMessage(t("passwordUpdated"));
  }

  async function changeVisibility(next: "public"|"players_only") {
    setSettingsVisibility(next);
    const ok = await saveSetting({ profile_visibility: next }, t("profileVisibilitySaved"));
    if (!ok) setSettingsVisibility(next === "public" ? "players_only" : "public");
  }

  async function changeCountryVisibility(checked: boolean) {
    setCountryPublic(checked);
    const ok = await saveSetting({ current_country_public: checked }, t("hoopFeedCountrySaved"));
    if (!ok) setCountryPublic(!checked);
  }

  if (loading) return <main className="page-shell hc-account-page"><div className="page-container"><HoopLoading label={t("loadingAccount")} /></div></main>;

  return (
    <main className="page-shell hc-account-page"><div className="page-container">
      <header className="hc-account-settings-header">
        <p className="hc-account-settings-kicker">{t("settings")}</p>
        <h1>{t("accountPreferences")}</h1>
        <div className="hc-account-settings-identity">
          <span className="hc-account-settings-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(displayName || email || "H").trim().charAt(0).toUpperCase()}</span>}
          </span>
          <div className="hc-account-settings-identity-copy">
            <strong>{displayName || t("yourAccount")}</strong>
            <p>{email || t("emailNotSet")}</p>
          </div>
        </div>
      </header>
      <section className="hc-settings" aria-label={t("accountSettings")}>
        <SettingsGroup title={t("accountSection")}>
          <SettingsRow icon="user" label={t("editProfile")} value={t("editDetails")} href="#profile-editor" />
          <SettingsRow icon="mail" label={t("email")} value={email || t("notSelected")} onClick={changeEmail} />
          <SettingsRow icon="lock" label={t("changePassword")} value={t("updatePassword")} onClick={() => { setPasswordMessage(""); setPasswordModal(true); }} />
          <SettingsRow icon="crown" label={t("membershipLabel")} value={subscription?.plan === "premium" ? "Premium" : subscription?.plan === "pro" ? t("pro") : t("freePlan")} href="/membership" />
        </SettingsGroup>
        <SettingsGroup title={t("preferences")}>
          <div className="hc-setting-row"><SettingsGlyph name="moon"/><div className="hc-setting-copy"><strong>{t("darkMode")}</strong><small>{themePreference === "system" ? t("followsDevice") : themePreference === "dark" ? t("on") : t("off")}</small></div><button type="button" role="switch" aria-checked={themePreference === "dark" || (themePreference === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)} className={"hc-switch "+((themePreference === "dark" || (themePreference === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)) ? "is-on" : "")} onClick={() => changeTheme((themePreference === "system" ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) : themePreference === "dark") ? "light" : "dark")}><span/></button></div>
          {themePreference !== "system" && <div className="hc-setting-subrow"><button type="button" className="hc-text-button" onClick={() => changeTheme("system")}>{t("useDeviceSetting")}</button></div>}
          <div className="hc-setting-row"><SettingsGlyph name="globe"/><div className="hc-setting-copy"><strong>{t("language")}</strong><small>{t("chooseAppLanguage")}</small></div><select aria-label={t("language")} className="hc-setting-select" value={preferredLanguage} onChange={e=>changeLanguage(e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="tr">Türkçe</option><option value="pt">Português</option><option value="it">Italiano</option><option value="el">Ελληνικά</option><option value="ar">العربية</option><option value="ru">Русский</option><option value="az">Azərbaycanca</option><option value="pl">Polski</option><option value="zh">中文</option><option value="ja">日本語</option><option value="sr">Српски</option><option value="fi">Suomi</option><option value="he">עברית</option><option value="lt">Lietuvių</option><option value="uk">Українська</option></select></div>
          <SettingsToggle icon="message" label={t("gameChatAlerts")} checked={notificationPreferences.game_chat_alerts} onChange={v=>changeNotification("game_chat_alerts",v)} />
          <SettingsToggle icon="user-plus" label={t("newFollower")} checked={notificationPreferences.new_follower} onChange={v=>changeNotification("new_follower",v)} />
          <SettingsToggle icon="star" label={t("teamFollowReview")} checked={notificationPreferences.team_reviews} onChange={v=>changeNotification("team_reviews",v)} />
          <SettingsToggle icon="activity" label={t("hoopFeedActivity")} checked={notificationPreferences.hoopfeed_activity} onChange={v=>changeNotification("hoopfeed_activity",v)} />
        </SettingsGroup>
        <SettingsGroup title={t("privacySection")}>
          <SettingsToggle icon="map-pin" label={t("showCountryOnFeed")} checked={countryPublic} onChange={changeCountryVisibility} />
          <div className="hc-setting-row"><SettingsGlyph name="eye"/><div className="hc-setting-copy"><strong>{t("whoCanSeeProfile")}</strong><small>{settingsVisibility === "public" ? t("public") : t("playersOnly")}</small></div><select aria-label={t("whoCanSeeProfile")} className="hc-setting-select" value={settingsVisibility} onChange={e=>changeVisibility(e.target.value as "public"|"players_only")}><option value="public">{t("public")}</option><option value="players_only">{t("playersOnly")}</option></select></div>
        </SettingsGroup>
        <SettingsGroup title={t("supportSection")}>
          <SettingsRow icon="help" label={t("helpFaq")} value={t("getAnswers")} href="/support" />
          <SettingsRow icon="headphones" label={t("contactSupport")} value={t("getInTouch")} href="/support" />
          <SettingsRow icon="file" label={t("terms")} value={t("readTerms")} href="/terms" />
          <SettingsRow icon="shield" label={t("privacyPolicy")} value={t("readPolicy")} href="/privacy" />
        </SettingsGroup>
        <SettingsGroup title={t("dangerZone")} danger>
          <SettingsRow icon="logout" label={t("signOut")} value={t("endSession")} onClick={signOut} danger />
          <SettingsRow icon="trash" label={t("deleteAccount")} value={deletingAccount ? t("deleting") : t("permanentAction")} onClick={() => { setDeleteConfirmation(""); setDeleteModal(true); }} danger />
        </SettingsGroup>
        {settingsMessage && <ThemeToast className="hc-settings-message">{settingsMessage}</ThemeToast>}
      </section>
      {passwordModal && <div className="hc-modal-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setPasswordModal(false)}}><section className="hc-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="hc-password-title"><button type="button" className="hc-modal-close" aria-label={t("close")} onClick={()=>setPasswordModal(false)}>×</button><p className="eyebrow">{t("security")}</p><h2 id="hc-password-title">{t("changePassword")}</h2><label htmlFor="hc-new-password">{t("newPassword")}</label><input id="hc-new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder={t("atLeast8CharactersPlaceholder")}/>{passwordMessage && <p role="alert">{passwordMessage}</p>}<button type="button" className="btn" onClick={submitPasswordChange}>{t("updatePassword")}</button></section></div>}
      {deleteModal && <div className="hc-modal-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setDeleteModal(false)}}><section className="hc-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="hc-delete-title"><button type="button" className="hc-modal-close" aria-label={t("close")} onClick={()=>setDeleteModal(false)}>×</button><p className="eyebrow" style={{color:"#ef4444"}}>{t("dangerZone")}</p><h2 id="hc-delete-title">{t("deleteAccountQuestion")}</h2><p>{t("deleteAccountWarning")}</p><label htmlFor="hc-delete-confirm">{t("typeDeleteConfirm")}</label><input id="hc-delete-confirm" value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} autoComplete="off" placeholder={t("typeDeleteConfirm")}/><button type="button" className="hc-danger-button" disabled={deleteConfirmation !== "DELETE" || deletingAccount} onClick={async()=>{setDeleteModal(false);await deleteAccountConfirmed();}}>{deletingAccount ? t("deleting") : t("permanentlyDeleteAccount")}</button></section></div>}
      <section className="grid" style={{marginTop:32}}>
        <div className="dashboard-card">
          <p className="eyebrow">{t("profileSection")}</p>
          {profile.account_type === "player" && <>
            {avatarUrl && <img src={avatarUrl} alt={t("profileSection")} style={{width:112,height:112,borderRadius:"50%",objectFit:"cover",border:"3px solid var(--orange)",display:"block"}} />}
            <label htmlFor="avatar-upload" className="muted">{t("playerProfilePicture")}</label>
            <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f) chooseAvatar(f)}} />
            <p className="muted" style={{fontSize:12}}>{avatarStatus==="pending" ? t("pendingModeration") : avatarStatus==="rejected" ? t("photoRejected") : t("approvedEligiblePublic")}</p>
            {cropPreview && <div className="dashboard-card" style={{marginTop:12}}>
              <span className="card-kicker">{t("cropPhoto")}</span>
              <div style={{width:"min(100%,280px)",aspectRatio:"1",overflow:"hidden",borderRadius:"50%",margin:"12px auto",border:"3px solid var(--orange)",background:"#111"}}>
                <img src={cropPreview} alt={t("cropPhoto")} style={{width:"100%",height:"100%",objectFit:"cover",transform:"scale("+cropZoom+")"}} />
              </div>
              <label className="muted" htmlFor="avatar-zoom">{t("zoom")}</label>
              <input id="avatar-zoom" type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={e=>setCropZoom(Number(e.target.value))} style={{width:"100%"}} />
              <div className="actions">
                <button type="button" className="btn" onClick={()=>void cropAndUploadAvatar()}>{t("useCroppedPhoto")}</button>
                <button type="button" className="btn dark" onClick={()=>{setCropFile(null);setCropPreview("")}}>{t("cancel")}</button>
              </div>
            </div>}
          </>}
          <h2>{profile.account_type === "player" ? t("playerInformation") : profile.account_type === "coach" ? t("coachInformation") : t("profileInformation")} {((profile.account_type === "player" && profile.player_verified) || (profile.account_type === "coach" && profile.coach_verified)) && <VerifiedBadge label={t("verifiedProfessional")} />}</h2>
          <Surface as="form" id="profile-editor" onSubmit={saveProfile} className="account-profile-form" style={{display:"grid",gap:12,marginTop:16}}>
            <label className="muted">{t("firstName")}</label><input value={profile.first_name ?? ""} readOnly />
            <label className="muted">{t("lastName")}</label><input value={profile.last_name ?? ""} readOnly />
            <p className="muted" style={{fontSize:12}}>{t("nameLocked")}</p>
            <label htmlFor="display-name" className="muted">{t("displayName")}</label><input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} placeholder={t("displayNamePlaceholder")} />
            {profile.account_type === "player" && <label htmlFor="position" className="muted">{t("position")}</label>}
            {profile.account_type === "player" && <input id="position" value={position} onChange={e => setPosition(e.target.value)} maxLength={40} placeholder="e.g. Point Guard" disabled={savingProfile} />}
            {profile.account_type === "player" && <label htmlFor="years-pro" className="muted">{t("yearsAsPro")}</label>}
            {profile.account_type === "player" && <input id="years-pro" type="number" value={yearsPro} readOnly disabled />}
            {profile.account_type === "coach" && <><label htmlFor="coaching-experience" className="muted">{t("coachingExperience")}</label><textarea id="coaching-experience" value={coachingExperience} onChange={e=>setCoachingExperience(e.target.value)} maxLength={1000} rows={4} placeholder={t("coachingExperiencePlaceholder")} /><label htmlFor="coach-specialties" className="muted">{t("coachingSpecialties")}</label><textarea id="coach-specialties" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder={t("coachingSpecialtiesPlaceholder")} /></>}
            <label htmlFor="hometown">{t("hometown")}</label><input id="hometown" value={hometown} onChange={e=>setHometown(e.target.value)} maxLength={120} placeholder={t("cityStateRegion")} />
            <label htmlFor="nationality">{t("nationality")}</label>
            <select id="nationality" value={nationality} onChange={e=>setNationality(e.target.value)} disabled={savingProfile}>
              <option value="">{t("selectNationality")}</option>
              <optgroup label={t("africa")}>
                {["Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon","Cape Verde","Central African Republic","Chad","Comoros","Côte d’Ivoire","Democratic Republic of the Congo","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Republic of the Congo","Rwanda","São Tomé and Príncipe","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label={t("asia")}>
                {["Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia","China","Chinese Taipei","Cyprus","Georgia","Hong Kong","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Tajikistan","Thailand","Timor-Leste","Turkmenistan","United Arab Emirates","Uzbekistan","Vietnam","Yemen"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label={t("europe")}>
                {["Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria","Croatia","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania","Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Türkiye","Ukraine","United Kingdom","Vatican City"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label={t("northAmerica")}>
                {["Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba","Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Trinidad and Tobago","United States"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label={t("southAmerica")}>
                {["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
              <optgroup label={t("oceania")}>
                {["Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"].map(x=><option key={x} value={x}>{x}</option>)}
              </optgroup>
            </select>
                        {profile.account_type === "player" && <>
              <label htmlFor="current-country" className="muted">{t("currentCountry")}</label><input id="current-country" value={currentCountry} onChange={e=>setCurrentCountry(e.target.value)} maxLength={80} placeholder="Country where you currently play" disabled={savingProfile} />
              <label htmlFor="current-team" className="muted">{t("currentTeam")}</label><input id="current-team" value={currentTeam} onChange={e=>setCurrentTeam(e.target.value)} maxLength={120} placeholder="Current team or Free Agent" disabled={savingProfile} />
            </>}
            <label htmlFor="bio" className="muted">{t("playerBio")}</label><textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={4} placeholder={t("playerBioPlaceholder")} />
                        {profile.account_type === "player" && <label className="checkbox-row"><input type="checkbox" checked={freeAgent} onChange={e=>setFreeAgent(e.target.checked)}/><span>{t("showFreeAgent")}</span></label>}
            {["scout","agent"].includes(profile.account_type) && <>
              <label htmlFor="interests" className="muted">{t("basketballInterests")}</label><textarea id="interests" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder={t("scoutAgentInterestsPlaceholder")} />
              <label htmlFor="favorite-leagues" className="muted">{t("leaguesOfInterest")}</label><textarea id="favorite-leagues" value={favoriteLeagues} onChange={e=>setFavoriteLeagues(e.target.value)} maxLength={500} rows={3} placeholder={t("leaguesMarketsPlaceholder")} />
            </>}
            {profile.account_type === "fan" && <label htmlFor="interests" className="muted">{t("basketballInterests")}</label>}
            {profile.account_type === "fan" && <textarea id="interests" value={interests} onChange={e=>setInterests(e.target.value)} maxLength={500} rows={3} placeholder={t("fanInterestsPlaceholder")} />}
            {["scout","agent","fan"].includes(profile.account_type) ? <div className="card"><strong><HoopIcon name="lock" size={16} /> {t("privateProfile")}</strong><p className="muted">{t("privateProfileDescription")}</p></div> : <><label htmlFor="visibility" className="muted">{t("profileVisibility")}</label><select id="visibility" value={visibility} onChange={e => setVisibility(e.target.value as "public" | "private")}><option value="public">{t("public")}</option><option value="private">{t("private")}</option></select></>}
            <p className="muted">{t("emailLabel")} {email}</p>
            <div className="card" style={{marginTop:4}}><strong>{profile.profile_claimed ? <><VerifiedBadge label={t("profileClaimed")} /> Profile claimed</> : t("claimPlayerProfile")}</strong><p className="muted">{profile.profile_claimed ? t("profileConnected") : t("claimProfileDescription")}</p></div>
            {profile.account_type === "player" && <div className="card" style={{marginTop:8}}><strong>{profile.player_verified ? <><VerifiedBadge label={t("verifiedPlayer")} /> {t("verifiedPlayer")}</> : t("playerVerification")}</strong><p className="muted">{profile.player_verified ? t("playerBadgeActive") : t("applyVerificationBadge")}</p>{!profile.player_verified && <Link href="/verification" className="btn dark">{t("requestVerification")}</Link>}</div>}
            {profile.account_type === "coach" && <div className="card" style={{marginTop:8,border:"1px solid var(--orange)"}}><strong>{profile.coach_verified ? <><VerifiedBadge label={t("verifiedProfessional")} /> Verified Coach</> : t("coachVerification")}</strong><p className="muted">{profile.coach_verified ? t("coachIdentityVerified") : t("coachVerifyInstructions")}</p>{!profile.coach_verified && <Link href="/verification" className="btn dark">{t("verifyCoach")}</Link>}{profile.coach_verified && <Link href="/dashboard" className="btn dark">{t("requestTeamPlacement")}</Link>}</div>}
            <button className="btn" type="submit" disabled={savingProfile}>{savingProfile ? t("saving") : t("saveProfile")}</button>
            {profileMessage && <p className="muted">{profileMessage}</p>}
          </Surface>
        </div>
        <div className="dashboard-card">
          <p className="eyebrow">{t("membership")}</p><h2>{subscription?.plan === "premium" ? "HoopCheck " + t("premium") : subscription?.plan === "pro" ? "HoopCheck " + t("pro") : t("free") + " " + t("membership")}</h2><p className="muted">{t("status")}: {t(subscription?.status ?? "inactive")}</p>
          {subscription?.current_period_end && <p className="muted">{t("currentPeriodEnds")} {new Date(subscription.current_period_end).toLocaleDateString()}</p>}
          {subscription?.cancel_at_period_end && <p className="muted">Cancellation is scheduled at the end of the current period.</p>}
          {subscription?.plan === "premium" && <div className="card" style={{marginTop:16,border:"1px solid var(--orange)"}}><p className="eyebrow">{t("premiumPlayerFeature")}</p><h3 style={{marginBottom:8}}><HoopIcon name="basketball" size={20} /> {t("getRecruitedComingSoon")}</h3><p className="muted">{t("recruitingFeatureDescription")}</p><p className="muted" style={{fontSize:12,marginBottom:0}}>{t("recruitingNetworkDescription")}</p></div>}
          <div className="account-actions hc-account-membership-actions" style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:12}}><Link href="/membership#manage-subscription" className="btn">{t("manageSubscription")}</Link>{subscription?.plan && subscription.status === "active" && !subscription.cancel_at_period_end && <Link href="/membership#manage-subscription" className="btn dark">{t("upgradeSubscription")}</Link>}</div>
        </div>
      </section>
      <section className="dashboard-card" style={{marginTop:24}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><div><p className="eyebrow">{t("privacy")}</p><h2>{t("managePersonalData")}</h2><p className="muted">{t("privacyRequestDescription")}</p></div><Link href="/privacy-center" className="btn">{t("privacyRequestCenter")}</Link></div></section>

      <section className="dashboard-card hc-account-public-profile" style={{marginTop:24}}><div className="hc-account-section-copy"><p className="eyebrow">{t("publicProfile")}</p><h2>{t("seeHowPlayersSeeYou")}</h2><p className="muted">{settingsVisibility === "public" ? t("previewPublicProfile") : t("profileNotPublicDescription")}</p></div><div className="actions hc-account-public-actions">{profile.account_type === "player" && (settingsVisibility === "public" ? <Link href={userId ? `/players/${encodeURIComponent(userId)}` : "/profile"} className="btn">{t("profilePublic")} <HoopIcon name="arrow-up-right" size={16} /></Link> : <a href="#profile-editor" className="btn">{t("editVisibility")}</a>)}<a href="#profile-editor" className="btn dark">{t("editProfile")}</a></div></section>\n\n      <section id="edit-profile" style={{marginTop:32}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:18}}><div><p className="eyebrow">{t("reviewHistory")}</p><h2>{t("myReviews")}</h2></div><Link href="/search" className="btn">{t("findAnother")}</Link></div>
      {!reviews.length ? <div className="dashboard-card"><h2>{t("noReviewsYet")}</h2><p>{t("shareExperience")}</p></div> :
        <div style={{display:"grid",gap:16}}>{reviews.map(review => { const targetId=review.coach_id??review.team_id??review.league_id??""; const target=targets[targetId]; const href=review.coach_id?"/coaches/"+targetId:review.team_id?"/teams/"+targetId:"/leagues/"+targetId; return <article key={review.id} className="dashboard-card"><div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><span className="card-kicker">{review.coach_id?t("coach").toUpperCase():review.team_id?t("team").toUpperCase():t("leagues").toUpperCase()}</span><h2>{target?.name??t("directoryEntry")}</h2></div><strong>{t(review.status).toUpperCase()}</strong></div>{review.title&&<h3>{review.title}</h3>}<p>{review.body}</p><p className="muted">{t("overall")}: {review.overall_rating}/5 · {new Date(review.created_at).toLocaleDateString()}</p><Link href={href} className="btn dark">{t("viewProfile")}</Link></article>; })}</div>}
      </section>
    </div></main>
  );
}