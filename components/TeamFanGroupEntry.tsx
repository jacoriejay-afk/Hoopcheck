"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage, type Language } from "./LanguageProvider";

type Summary = { group_name: string; member_count: number; join_mode: "open" | "approval"; is_member: boolean; has_pending_request: boolean };
type FanGroupCopy={kicker:string;members:string;open:string;approval:string;moderatorOpen:string;joinedOpen:string;wait:string;pending:string;join:string;signIn:string;requestSent:string;joinedMessage:string;failed:string;leave:string};
const fanGroupCopy:Record<Language,FanGroupCopy>={
 en:{kicker:"FAN HQ · OFFICIAL COMMUNITY",members:"members",open:"Open to join",approval:"Approval required",moderatorOpen:"Moderator · Open Group",joinedOpen:"Joined · Open Group",wait:"Please wait…",pending:"Pending",join:"Join Fan Group",signIn:"Sign in as a fan to join this group.",requestSent:"Request sent. A moderator will review it.",joinedMessage:"You joined the Fan Group.",failed:"Could not join the group. Please try again.",leave:"Leave Group"},
 es:{kicker:"FAN HQ · COMUNIDAD OFICIAL",members:"miembros",open:"Acceso abierto",approval:"Requiere aprobación",moderatorOpen:"Moderador · Abrir grupo",joinedOpen:"Unido · Abrir grupo",wait:"Espere…",pending:"Pendiente",join:"Unirse al grupo de fanáticos",signIn:"Inicia sesión como fan para unirte al grupo.",requestSent:"Solicitud enviada. Un moderador la revisará.",joinedMessage:"Te uniste al grupo de fanáticos.",failed:"No se pudo unir al grupo. Inténtalo de nuevo.",leave:"Salir del grupo"},
 fr:{kicker:"FAN HQ · COMMUNAUTÉ OFFICIALE",members:"membres",open:"Ouvert à tous",approval:"Approbation requise",moderatorOpen:"Modérateur · Groupe ouvert",joinedOpen:"Membre · Groupe ouvert",wait:"Patientez…",pending:"En attente",join:"Rejoindre le groupe de fans",signIn:"Connectez-vous en tant que fan pour rejoindre le groupe.",requestSent:"Demande envoyée. Un modérateur la vérifiera.",joinedMessage:"Vous avez rejoint le groupe de fans.",failed:"Impossible de rejoindre le groupe. Réessayez.",leave:"Quitter le groupe"},
 de:{kicker:"FAN HQ · OFFIZIELLE COMMUNITY",members:"Mitglieder",open:"Offen zum Beitreten",approval:"Genehmigung erforderlich",moderatorOpen:"Moderator · Gruppe öffnen",joinedOpen:"Beigetreten · Gruppe öffnen",wait:"Bitte warten…",pending:"Ausstehend",join:"Fan-Gruppe beitreten",signIn:"Melde dich als Fan an, um der Gruppe beizutreten.",requestSent:"Anfrage gesendet. Ein Moderator prüft sie.",joinedMessage:"Du bist der Fan-Gruppe beigetreten.",failed:"Der Gruppe konnte nicht beigetreten werden. Bitte versuche es erneut.",leave:"Gruppe verlassen"},
 tr:{kicker:"FAN HQ · RESMİ TOPLULUK",members:"üye",open:"Katılıma açık",approval:"Onay gerekli",moderatorOpen:"Moderatör · Grubu aç",joinedOpen:"Katıldın · Grubu aç",wait:"Lütfen bekleyin…",pending:"Bekliyor",join:"Fan grubuna katıl",signIn:"Gruba katılmak için fan olarak giriş yapın.",requestSent:"İstek gönderildi. Bir moderatör inceleyecek.",joinedMessage:"Fan grubuna katıldın.",failed:"Gruba katılma işlemi başarısız oldu. Lütfen tekrar deneyin.",leave:"Gruptan ayrıl"},
 pt:{kicker:"FAN HQ · COMUNIDADE OFICIAL",members:"membros",open:"Entrada aberta",approval:"Aprovação necessária",moderatorOpen:"Moderador · Abrir grupo",joinedOpen:"Inscrito · Abrir grupo",wait:"Aguarde…",pending:"Pendente",join:"Entrar no grupo de fãs",signIn:"Entre como fã para entrar no grupo.",requestSent:"Pedido enviado. Um moderador vai revisá-lo.",joinedMessage:"Você entrou no grupo de fãs.",failed:"Não foi possível entrar no grupo. Tente novamente.",leave:"Sair do grupo"},
 it:{kicker:"FAN HQ · COMMUNITY UFFICIALE",members:"membri",open:"Aperto a tutti",approval:"Approvazione richiesta",moderatorOpen:"Moderatore · Apri gruppo",joinedOpen:"Iscritto · Apri gruppo",wait:"Attendi…",pending:"In sospeso",join:"Unisciti al gruppo dei fan",signIn:"Accedi come fan per unirti al gruppo.",requestSent:"Richiesta inviata. Un moderatore la esaminerà.",joinedMessage:"Ti sei unito al gruppo dei fan.",failed:"Impossibile unirsi al gruppo. Riprova.",leave:"Lascia il gruppo"},
 el:{kicker:"FAN HQ · ΕΠΙΣΗΜΗ ΚΟΙΝΟΤΗΤΑ",members:"μέλη",open:"Ανοιχτό για συμμετοχή",approval:"Απαιτείται έγκριση",moderatorOpen:"Συντονιστής · Άνοιγμα ομάδας",joinedOpen:"Συμμετέχεις · Άνοιγμα ομάδας",wait:"Περιμένετε…",pending:"Εκκρεμεί",join:"Συμμετοχή στην ομάδα οπαδών",signIn:"Συνδεθείτε ως fan για να συμμετάσχετε στην ομάδα.",requestSent:"Η αίτηση εστάλη. Ένας συντονιστής θα την ελέγξει.",joinedMessage:"Συμμετέχετε στην ομάδα οπαδών.",failed:"Δεν ήταν δυνατή η συμμετοχή στην ομάδα. Προσπαθήστε ξανά.",leave:"Αποχώρηση από την ομάδα"},
 ar:{kicker:"FAN HQ · المجتمع الرسمي",members:"أعضاء",open:"مفتوح للانضمام",approval:"يتطلب الموافقة",moderatorOpen:"المشرف · فتح المجموعة",joinedOpen:"انضممت · فتح المجموعة",wait:"يرجى الانتظار…",pending:"قيد الانتظار",join:"الانضمام إلى مجموعة المشجعين",signIn:"سجل الدخول كأحد المشجعين للانضمام إلى المجموعة.",requestSent:"تم إرسال الطلب. سيقوم أحد المشرفين بمراجعته.",joinedMessage:"لقد انضممت إلى مجموعة المشجعين.",failed:"تعذّر الانضمام إلى المجموعة. حاول مرة أخرى.",leave:"مغادرة المجموعة"},
 ru:{kicker:"FAN HQ · ОФИЦИАЛЬНОЕ СООБЩЕСТВО",members:"участников",open:"Открыто для вступления",approval:"Требуется одобрение",moderatorOpen:"Модератор · Открыть группу",joinedOpen:"Вы в группе · Открыть группу",wait:"Пожалуйста, подождите…",pending:"Ожидание",join:"Присоединиться к фан-группе",signIn:"Войдите как фанат, чтобы присоединиться к группе.",requestSent:"Запрос отправлен. Модератор рассмотрит его.",joinedMessage:"Вы присоединились к фан-группе.",failed:"Не удалось присоединиться к группе. Попробуйте еще раз.",leave:"Покинуть группу"},
 az:{kicker:"FAN HQ · RƏSMİ İCMA",members:"üzv",open:"Qoşulmaq açıqdır",approval:"Təsdiq tələb olunur",moderatorOpen:"Moderator · Qrupu aç",joinedOpen:"Qoşuldun · Qrupu aç",wait:"Gözləyin…",pending:"Gözləyir",join:"Fan qrupuna qoşul",signIn:"Qrupa qoşulmaq üçün fan kimi daxil olun.",requestSent:"Sorğu göndərildi. Moderator nəzərdən keçirəcək.",joinedMessage:"Fan qrupuna qoşuldunuz.",failed:"Qruba qoşulma uğursuz oldu. Yenidən cəhd edin.",leave:"Gruptan çıx"},
 pl:{kicker:"FAN HQ · OFICJALNA SPOŁECZNOŚĆ",members:"członków",open:"Otwarta grupa",approval:"Wymagana akceptacja",moderatorOpen:"Moderator · Otwórz grupę",joinedOpen:"Dołączono · Otwórz grupę",wait:"Proszę czekać…",pending:"Oczekujące",join:"Dołącz do grupy fanów",signIn:"Zaloguj się jako fan, aby dołączyć do grupy.",requestSent:"Wniosek wysłany. Moderator go sprawdzi.",joinedMessage:"Dołączyłeś do grupy fanów.",failed:"Nie udało się dołączyć do grupy. Spróbuj ponownie.",leave:"Opuść grupę"},
 zh:{kicker:"粉丝专区 · 官方社区",members:"位成员",open:"开放加入",approval:"需要批准",moderatorOpen:"版主 · 打开群组",joinedOpen:"已加入 · 打开群组",wait:"请稍候…",pending:"待审核",join:"加入粉丝群",signIn:"请以粉丝身份登录后加入该群。",requestSent:"已提交申请。版主将审核。",joinedMessage:"你已加入粉丝群。",failed:"无法加入该群。请重试。",leave:"离开群组"},
 ja:{kicker:"ファンHQ · 公式コミュニティ",members:"人",open:"自由に参加可能",approval:"承認が必要",moderatorOpen:"モデレーター · グループを開く",joinedOpen:"参加済み · グループを開く",wait:"少々お待ちください…",pending:"保留中",join:"ファングループに参加",signIn:"ファンとしてログインしてグループに参加してください。",requestSent:"申請を送信しました。モデレーターが確認します。",joinedMessage:"ファングループに参加しました。",failed:"グループに参加できませんでした。もう一度お試しください。",leave:"グループを退出"},
 sr:{kicker:"FAN HQ · ZVANIČNA ZAJEDNICA",members:"članova",open:"Otvoreno za pridruživanje",approval:"Potrebno odobrenje",moderatorOpen:"Moderator · Otvori grupu",joinedOpen:"Pridružio/la si se · Otvori grupu",wait:"Sačekajte…",pending:"Na čekanju",join:"Pridruži se fan grupi",signIn:"Prijavite se kao fan da biste se pridružili grupi.",requestSent:"Zahtev je poslat. Moderator će ga pregledati.",joinedMessage:"Pridružili ste se fan grupi.",failed:"Nismo uspeli da vas pridružimo grupi. Pokušajte ponovo.",leave:"Napusti grupu"},
 fi:{kicker:"FAN HQ · VIRALLINEN YHTEISÖ",members:"jäsentä",open:"Avoin liittyminen",approval:"Hyväksyntä vaaditaan",moderatorOpen:"Moderaattori · Avaa ryhmä",joinedOpen:"Liitytty · Avaa ryhmä",wait:"Odota…",pending:"Odottaa",join:"Liity faniryhmään",signIn:"Kirjaudu fanina liittyäksesi ryhmään.",requestSent:"Pyyntö lähetetty. Moderaattori tarkistaa sen.",joinedMessage:"Liityit faniryhmään.",failed:"Ryhmään liittyminen epäonnistui. Yritä uudelleen.",leave:"Poistu ryhmästä"},
 he:{kicker:"FAN HQ · קהילה רשמית",members:"חברים",open:"פתוח להצטרפות",approval:"נדרש אישור",moderatorOpen:"מנהל קבוצה · פתיחת קבוצה",joinedOpen:"הצטרפת · פתיחת קבוצה",wait:"המתן…",pending:"ממתין",join:"הצטרף לקבוצת המעריצים",signIn:"התחבר כמעריץ כדי להצטרף לקבוצה.",requestSent:"הבקשה נשלחה. מנהל יבדוק אותה.",joinedMessage:"הצטרפת לקבוצת המעריצים.",failed:"לא ניתן היה להצטרף לקבוצה. נסה שוב.",leave:"עזוב את הקבוצה"},
 lt:{kicker:"FAN HQ · OFICIALI BENDRUOMENĖ",members:"narių",open:"Atvira prisijungti",approval:"Reikalingas patvirtinimas",moderatorOpen:"Moderatorius · Atidaryti grupę",joinedOpen:"Prisijungta · Atidaryti grupę",wait:"Palaukite…",pending:"Laukiama",join:"Prisijungti prie fanų grupės",signIn:"Prisijunkite kaip fanas, kad prisijungtumėte prie grupės.",requestSent:"Prašymas išsiųstas. Moderatoriaus patvirtinimas bus atliktas.",joinedMessage:"Jūs prisijungėte prie fanų grupės.",failed:"Nepavyko prisijungti prie grupės. Bandykite dar kartą.",leave:"Išeiti iš grupės"},
 uk:{kicker:"FAN HQ · ОФІЦІЙНА СПІЛЬНОТА",members:"учасників",open:"Відкрита для вступу",approval:"Потрібне схвалення",moderatorOpen:"Модератор · Відкрити групу",joinedOpen:"Ви приєдналися · Відкрити групу",wait:"Зачекайте…",pending:"Запит очікує",join:"Приєднатися до групи фанатів",signIn:"Увійдіть як фанат, щоб приєднатися до групи.",requestSent:"Запит надіслано. Модератор його розгляне.",joinedMessage:"Ви приєдналися до групи фанатів.",failed:"Не вдалося приєднатися до групи. Спробуйте ще раз.",leave:"Вийти з групи"}
};

export default function TeamFanGroupEntry({ teamId }: { teamId: string }) {
  const { language, formatNumber } = useLanguage();
  const labels = fanGroupCopy[language] || fanGroupCopy.en;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isFan, setIsFan] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [actualMember, setActualMember] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [{ data: { user }, error: authError }, { data: rows, error: summaryError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_team_fan_group_summary", { p_team_id: teamId })
    ]);
    if (authError || summaryError) throw authError || summaryError;

    let nextActualMember = false;
    if (user) {
      const [{ data: profile, error: profileError }, { data: moderators, error: moderatorsError }, { data: platformAdmin, error: adminError }, { data: membership, error: membershipError }] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        supabase.from("team_fan_group_moderators").select("user_id,moderator_type").eq("team_id", teamId),
        supabase.rpc("is_current_user_admin_or_moderator"),
        supabase.from("team_fan_group_members").select("user_id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle()
      ]);
      if (profileError || moderatorsError || adminError || membershipError) throw profileError || moderatorsError || adminError || membershipError;
      nextActualMember = Boolean(membership);
      setActualMember(nextActualMember);
      setIsFan(profile?.account_type === "fan");
      setIsModerator(Boolean((moderators || []).some((m: any) => m.user_id === user.id) ||
        ((moderators || []).some((m: any) => m.moderator_type === "platform") && platformAdmin === true)));
    } else {
      setIsFan(false);
      setIsModerator(false);
      setActualMember(false);
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    const normalizedRow = row ? { ...row, is_member: row.is_member || nextActualMember } : row;
    setSummary(normalizedRow || null);
  }, [teamId]);

  useEffect(() => { void load().catch(() => setMessage(labels.failed)); }, [load, labels.failed]);

  const isJoined = actualMember ?? Boolean(summary?.is_member);

  async function join() {
    setBusy(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setMessage(labels.signIn); return; }
      const form = new FormData();
      form.append("action", "join");
      form.append("team_id", teamId);
      const response = await fetch("/api/fan-groups", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setMessage(typeof result.message === "string" && result.message ? result.message : labels.failed);
        return;
      }
      setActualMember(true);
      setSummary(current => current ? { ...current, is_member: true, member_count: Math.max(1, Number(current.member_count || 0) + (current.is_member ? 0 : 1)) } : current);
      try { await load(); } catch { /* API confirmed membership; keep optimistic state until refresh completes. */ }
      setMessage(labels.joinedMessage);
    } catch {
      setMessage(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!window.confirm("Leave this Fan Group? You can join again anytime.")) return;
    setBusy(true);
    setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setMessage(labels.signIn); return; }
      const form = new FormData();
      form.append("action", "leave");
      form.append("team_id", teamId);
      const response = await fetch("/api/fan-groups", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) { setMessage(result.message || "Could not leave this group."); return; }
      setActualMember(false);
      setSummary(current => current ? { ...current, is_member: false, member_count: Math.max(0, Number(current.member_count || 0) - (current.is_member ? 1 : 0)) } : current);
      try { await load(); } catch { /* API confirmed membership removal; keep optimistic state until refresh completes. */ }
      setMessage("You left the Fan Group. You can rejoin anytime.");
    } catch { setMessage("Could not leave this group. Please try again."); }
    finally { setBusy(false); }
  }

  if ((!isFan && !isModerator) || !summary) return null;
  return <section className="hc-team-fan-group-entry">
    <div><p className="eyebrow">{labels.kicker}</p><h2>{summary.group_name}</h2><p className="muted">{formatNumber(Number(summary.member_count || 0))} {labels.members} · {labels.open}</p></div>
    <div className="hc-fan-group-actions">
      {isFan && (isJoined
        ? <><Link className="btn" href={"/team-hub/groups/" + teamId}>{labels.joinedOpen}</Link><button type="button" className="btn hc-fan-group-leave" disabled={busy} onClick={() => void leave()}>{busy ? labels.wait : labels.leave}</button></>
        : <button className="btn" type="button" disabled={busy} onClick={() => void join()}>{busy ? labels.wait : labels.join}</button>) }
      {isModerator && <Link className="btn hc-fan-group-moderator-link" href={"/team-hub/groups/" + teamId}>{labels.moderatorOpen}</Link>}
    </div>
    {message && <p className="hc-feed-message" role="status">{message}</p>}
  </section>;
}
