"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage, type Language } from "./LanguageProvider";

type Summary = { group_name: string; member_count: number; join_mode: "open" | "approval"; is_member: boolean; has_pending_request: boolean };
type FanGroupCopy={kicker:string;members:string;open:string;approval:string;moderatorOpen:string;joinedOpen:string;wait:string;pending:string;join:string;signIn:string;requestSent:string;joinedMessage:string;failed:string};
const fanGroupCopy:Record<Language,FanGroupCopy>={
en:{kicker:"FAN HQ · OFFICIAL COMMUNITY",members:"members",open:"Open to join",approval:"Approval required",moderatorOpen:"Moderator · Open Group",joinedOpen:"Joined · Open Group",wait:"Please wait…",pending:"Request Pending",join:"Join Fan Group",signIn:"Sign in as a fan to join this group.",requestSent:"Join request sent. A moderator will review it.",joinedMessage:"You joined the Fan Group.",failed:"Could not join this group. Please try again."},
es:{kicker:"FAN HQ · COMUNIDAD OFICIAL",members:"miembros",open:"Acceso abierto",approval:"Requiere aprobación",moderatorOpen:"Moderador · Abrir grupo",joinedOpen:"Unido · Abrir grupo",wait:"Espera…",pending:"Solicitud pendiente",join:"Unirse al grupo de fans",signIn:"Inicia sesión como fan para unirte a este grupo.",requestSent:"Solicitud enviada. Un moderador la revisará.",joinedMessage:"Te has unido al grupo de fans.",failed:"No se pudo unir al grupo. Inténtalo de nuevo."},
fr:{kicker:"FAN HQ · COMMUNAUTÉ OFFICIELLE",members:"membres",open:"Ouvert à tous",approval:"Approbation requise",moderatorOpen:"Modérateur · Ouvrir le groupe",joinedOpen:"Membre · Ouvrir le groupe",wait:"Veuillez patienter…",pending:"Demande en attente",join:"Rejoindre le groupe de fans",signIn:"Connectez-vous comme fan pour rejoindre ce groupe.",requestSent:"Demande envoyée. Un modérateur va l’examiner.",joinedMessage:"Vous avez rejoint le groupe de fans.",failed:"Impossible de rejoindre ce groupe. Réessayez."},
de:{kicker:"FAN HQ · OFFIZIELLE COMMUNITY",members:"Mitglieder",open:"Offen zum Beitreten",approval:"Genehmigung erforderlich",moderatorOpen:"Moderator · Gruppe öffnen",joinedOpen:"Beigetreten · Gruppe öffnen",wait:"Bitte warten…",pending:"Anfrage ausstehend",join:"Fan-Gruppe beitreten",signIn:"Melde dich als Fan an, um dieser Gruppe beizutreten.",requestSent:"Beitrittsanfrage gesendet. Ein Moderator prüft sie.",joinedMessage:"Du bist der Fan-Gruppe beigetreten.",failed:"Beitritt nicht möglich. Bitte versuche es erneut."},
tr:{kicker:"FAN HQ · RESMİ TOPLULUK",members:"üye",open:"Katılıma açık",approval:"Onay gerekli",moderatorOpen:"Moderatör · Grubu aç",joinedOpen:"Katıldın · Grubu aç",wait:"Lütfen bekleyin…",pending:"İstek beklemede",join:"Fan Grubuna Katıl",signIn:"Bu gruba katılmak için fan hesabınla giriş yap.",requestSent:"Katılma isteği gönderildi. Bir moderatör inceleyecek.",joinedMessage:"Fan Grubuna katıldın.",failed:"Gruba katılınamadı. Lütfen tekrar deneyin."},
pt:{kicker:"FAN HQ · COMUNIDADE OFICIAL",members:"membros",open:"Entrada aberta",approval:"Aprovação necessária",moderatorOpen:"Moderador · Abrir grupo",joinedOpen:"Inscrito · Abrir grupo",wait:"Aguarde…",pending:"Pedido pendente",join:"Entrar no grupo de fãs",signIn:"Inicie sessão como fã para entrar neste grupo.",requestSent:"Pedido enviado. Um moderador irá analisá-lo.",joinedMessage:"Entrou no grupo de fãs.",failed:"Não foi possível entrar no grupo. Tente novamente."},
it:{kicker:"FAN HQ · COMMUNITY UFFICIALE",members:"membri",open:"Aperto a tutti",approval:"Approvazione richiesta",moderatorOpen:"Moderatore · Apri gruppo",joinedOpen:"Iscritto · Apri gruppo",wait:"Attendi…",pending:"Richiesta in attesa",join:"Unisciti al gruppo fan",signIn:"Accedi come fan per unirti a questo gruppo.",requestSent:"Richiesta inviata. Un moderatore la esaminerà.",joinedMessage:"Ti sei unito al gruppo fan.",failed:"Impossibile unirsi al gruppo. Riprova."},
el:{kicker:"FAN HQ · ΕΠΙΣΗΜΗ ΚΟΙΝΟΤΗΤΑ",members:"μέλη",open:"Ανοιχτό για συμμετοχή",approval:"Απαιτείται έγκριση",moderatorOpen:"Συντονιστής · Άνοιγμα ομάδας",joinedOpen:"Μέλος · Άνοιγμα ομάδας",wait:"Περιμένετε…",pending:"Εκκρεμεί αίτημα",join:"Συμμετοχή στην ομάδα φιλάθλων",signIn:"Συνδεθείτε ως φίλαθλος για να συμμετάσχετε.",requestSent:"Το αίτημα στάλθηκε. Θα το εξετάσει συντονιστής.",joinedMessage:"Συμμετέχετε στην ομάδα φιλάθλων.",failed:"Δεν ήταν δυνατή η συμμετοχή. Δοκιμάστε ξανά."},
ar:{kicker:"FAN HQ · المجتمع الرسمي",members:"أعضاء",open:"مفتوح للانضمام",approval:"يتطلب الموافقة",moderatorOpen:"مشرف · فتح المجموعة",joinedOpen:"منضم · فتح المجموعة",wait:"يرجى الانتظار…",pending:"الطلب قيد الانتظار",join:"الانضمام إلى مجموعة المشجعين",signIn:"سجّل الدخول كمشجع للانضمام إلى هذه المجموعة.",requestSent:"تم إرسال طلب الانضمام. سيراجعه أحد المشرفين.",joinedMessage:"لقد انضممت إلى مجموعة المشجعين.",failed:"تعذر الانضمام إلى المجموعة. حاول مرة أخرى."},
ru:{kicker:"FAN HQ · ОФИЦИАЛЬНОЕ СООБЩЕСТВО",members:"участников",open:"Открыто для вступления",approval:"Требуется одобрение",moderatorOpen:"Модератор · Открыть группу",joinedOpen:"Вы вступили · Открыть группу",wait:"Подождите…",pending:"Запрос ожидает ответа",join:"Вступить в группу фанатов",signIn:"Войдите как фанат, чтобы вступить в группу.",requestSent:"Запрос отправлен. Модератор рассмотрит его.",joinedMessage:"Вы вступили в группу фанатов.",failed:"Не удалось вступить в группу. Попробуйте ещё раз."},
az:{kicker:"FAN HQ · RƏSMİ İCMA",members:"üzv",open:"Qoşulmaq açıqdır",approval:"Təsdiq tələb olunur",moderatorOpen:"Moderator · Qrupu aç",joinedOpen:"Qoşuldun · Qrupu aç",wait:"Gözləyin…",pending:"Sorğu gözləyir",join:"Fan qrupuna qoşul",signIn:"Bu qrupa qoşulmaq üçün fan hesabı ilə daxil ol.",requestSent:"Qoşulma sorğusu göndərildi. Moderator baxacaq.",joinedMessage:"Fan qrupuna qoşuldun.",failed:"Qrupa qoşulmaq mümkün olmadı. Yenidən cəhd et."},
pl:{kicker:"FAN HQ · OFICJALNA SPOŁECZNOŚĆ",members:"członków",open:"Otwarta grupa",approval:"Wymagana akceptacja",moderatorOpen:"Moderator · Otwórz grupę",joinedOpen:"Dołączono · Otwórz grupę",wait:"Proszę czekać…",pending:"Prośba oczekuje",join:"Dołącz do grupy fanów",signIn:"Zaloguj się jako fan, aby dołączyć do tej grupy.",requestSent:"Prośba wysłana. Moderator ją rozpatrzy.",joinedMessage:"Dołączono do grupy fanów.",failed:"Nie udało się dołączyć do grupy. Spróbuj ponownie."},
zh:{kicker:"粉丝专区 · 官方社区",members:"位成员",open:"开放加入",approval:"需要批准",moderatorOpen:"版主 · 打开群组",joinedOpen:"已加入 · 打开群组",wait:"请稍候…",pending:"请求待处理",join:"加入粉丝群组",signIn:"请以粉丝身份登录后加入此群组。",requestSent:"加入请求已发送，版主将进行审核。",joinedMessage:"你已加入粉丝群组。",failed:"无法加入群组，请重试。"},
ja:{kicker:"ファンHQ · 公式コミュニティ",members:"人",open:"自由に参加可能",approval:"承認が必要",moderatorOpen:"モデレーター · グループを開く",joinedOpen:"参加済み · グループを開く",wait:"お待ちください…",pending:"リクエスト保留中",join:"ファングループに参加",signIn:"ファンとしてログインしてグループに参加してください。",requestSent:"参加リクエストを送信しました。モデレーターが確認します。",joinedMessage:"ファングループに参加しました。",failed:"グループに参加できませんでした。もう一度お試しください。"},
sr:{kicker:"FAN HQ · ZVANIČNA ZAJEDNICA",members:"članova",open:"Otvoreno za pridruživanje",approval:"Potrebno odobrenje",moderatorOpen:"Moderator · Otvori grupu",joinedOpen:"Pridružio/la si se · Otvori grupu",wait:"Sačekajte…",pending:"Zahtev na čekanju",join:"Pridruži se grupi navijača",signIn:"Prijavi se kao navijač da bi se pridružio/la grupi.",requestSent:"Zahtev je poslat. Moderator će ga pregledati.",joinedMessage:"Pridružio/la si se grupi navijača.",failed:"Nije moguće pridružiti se grupi. Pokušaj ponovo."},
fi:{kicker:"FAN HQ · VIRALLINEN YHTEISÖ",members:"jäsentä",open:"Avoin liittyminen",approval:"Hyväksyntä vaaditaan",moderatorOpen:"Moderaattori · Avaa ryhmä",joinedOpen:"Liitytty · Avaa ryhmä",wait:"Odota…",pending:"Pyyntö odottaa",join:"Liity faniryhmään",signIn:"Kirjaudu fanina liittyäksesi tähän ryhmään.",requestSent:"Liittymispyyntö lähetetty. Moderaattori tarkistaa sen.",joinedMessage:"Liityit faniryhmään.",failed:"Ryhmään liittyminen epäonnistui. Yritä uudelleen."},
he:{kicker:"FAN HQ · קהילה רשמית",members:"חברים",open:"פתוח להצטרפות",approval:"נדרש אישור",moderatorOpen:"מנהל קבוצה · פתיחת קבוצה",joinedOpen:"הצטרפת · פתיחת קבוצה",wait:"נא להמתין…",pending:"הבקשה ממתינה",join:"הצטרפות לקבוצת אוהדים",signIn:"התחברו כאוהדים כדי להצטרף לקבוצה.",requestSent:"בקשת ההצטרפות נשלחה. מנהל קבוצה יבדוק אותה.",joinedMessage:"הצטרפת לקבוצת האוהדים.",failed:"לא ניתן להצטרף לקבוצה. נסו שוב."},
lt:{kicker:"FAN HQ · OFICIALI BENDRUOMENĖ",members:"narių",open:"Atvira prisijungti",approval:"Reikalingas patvirtinimas",moderatorOpen:"Moderatorius · Atidaryti grupę",joinedOpen:"Prisijungei · Atidaryti grupę",wait:"Palaukite…",pending:"Užklausa laukiama",join:"Prisijungti prie fanų grupės",signIn:"Prisijunk kaip fanas, kad galėtum prisijungti prie grupės.",requestSent:"Prisijungimo užklausa išsiųsta. Moderatorius ją peržiūrės.",joinedMessage:"Prisijungei prie fanų grupės.",failed:"Nepavyko prisijungti prie grupės. Bandykite dar kartą."},
uk:{kicker:"FAN HQ · ОФІЦІЙНА СПІЛЬНОТА",members:"учасників",open:"Відкрита для вступу",approval:"Потрібне схвалення",moderatorOpen:"Модератор · Відкрити групу",joinedOpen:"Ви приєдналися · Відкрити групу",wait:"Зачекайте…",pending:"Запит очікує",join:"Приєднатися до групи фанатів",signIn:"Увійдіть як фанат, щоб приєднатися до групи.",requestSent:"Запит надіслано. Модератор його розгляне.",joinedMessage:"Ви приєдналися до групи фанатів.",failed:"Не вдалося приєднатися до групи. Спробуйте ще раз."}
};


export default function TeamFanGroupEntry({ teamId }: { teamId: string }) {
  const { language, formatNumber } = useLanguage();
  const labels = fanGroupCopy[language] || fanGroupCopy.en;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isFan, setIsFan] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [{ data: { user } }, { data: rows }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_team_fan_group_summary", { p_team_id: teamId })
    ]);
    if (user) {
      const [{ data: profile }, { data: moderators }, { data: platformAdmin }] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        supabase.from("team_fan_group_moderators").select("user_id,moderator_type").eq("team_id", teamId),
        supabase.rpc("is_current_user_admin_or_moderator")
      ]);
      setIsFan(profile?.account_type === "fan");
      setIsModerator(Boolean((moderators || []).some((m: any) => m.user_id === user.id) ||
        ((moderators || []).some((m: any) => m.moderator_type === "platform") && platformAdmin === true)));
    } else {
      setIsFan(false);
      setIsModerator(false);
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    setSummary(row || null);
  }, [teamId]);
  useEffect(() => { void load(); }, [load]);
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
      await load();
      setMessage(result.requested ? labels.requestSent : labels.joinedMessage);
    } catch {
      setMessage(labels.failed);
    } finally {
      setBusy(false);
    }
  }
  if ((!isFan && !isModerator) || !summary) return null;
  return <section className="hc-team-fan-group-entry">
    <div><p className="eyebrow">{labels.kicker}</p><h2>{summary.group_name}</h2><p className="muted">{formatNumber(Number(summary.member_count || 0))} {labels.members} · {summary.join_mode === "open" ? labels.open : labels.approval}</p></div>
    {isModerator ? <Link className="btn" href={"/team-hub/groups/" + teamId}>{labels.moderatorOpen}</Link> : isFan && (summary.is_member
      ? <Link className="btn" href={"/team-hub/groups/" + teamId}>{labels.joinedOpen}</Link>
      : <button className="btn" type="button" disabled={busy || summary.has_pending_request} onClick={() => void join()}>{busy ? labels.wait : summary.has_pending_request ? labels.pending : labels.join}</button>)}
    {message && <p className="hc-feed-message" role="status">{message}</p>}
  </section>;
}
