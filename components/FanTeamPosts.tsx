"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useLanguage, type Language } from "./LanguageProvider";
import { fanFeedI18n } from "../app/fan-feed/i18n";

type TeamFanPost = { id:string; author_id:string; body:string; image_url:string|null; image_src?:string|null; is_pinned:boolean; created_at:string; profiles?:{display_name:string|null;avatar_url:string|null}|null };
type TeamGame = { id:string; opponent_name:string; status:string; scheduled_at:string|null; started_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

type FanTeamHubLabels = { kicker:string; title:string; description:string; openFeed:string; games:string; liveNow:string; versus:string; upNext:string; allUpdates:string };
const fanTeamHubLabels: Record<Language, FanTeamHubLabels> = {
 en:{kicker:"FAN HQ · TEAM HUB",title:"Your Team Hub",description:"Upcoming games and the latest fan updates for this team.",openFeed:"Open Fan HoopFeed",games:"Next games & live score",liveNow:"LIVE NOW",versus:"vs.",upNext:"UP NEXT",allUpdates:"All fan updates"},
 es:{kicker:"FAN HQ · CENTRO DEL EQUIPO",title:"Centro de tu equipo",description:"Próximos partidos y las últimas novedades de los fans de este equipo.",openFeed:"Abrir Fan HoopFeed",games:"Próximos partidos y marcador en directo",liveNow:"EN DIRECTO",versus:"contra",upNext:"PRÓXIMO",allUpdates:"Todas las novedades de fans"},
 fr:{kicker:"FAN HQ · ESPACE ÉQUIPE",title:"L’espace de votre équipe",description:"Les prochains matchs et les dernières actualités des fans de cette équipe.",openFeed:"Ouvrir le Fan HoopFeed",games:"Prochains matchs et score en direct",liveNow:"EN DIRECT",versus:"contre",upNext:"À VENIR",allUpdates:"Toutes les actualités des fans"},
 de:{kicker:"FAN HQ · TEAM-HUB",title:"Dein Team-Hub",description:"Kommende Spiele und die neuesten Fan-Updates zu diesem Team.",openFeed:"Fan-HoopFeed öffnen",games:"Nächste Spiele & Live-Spielstand",liveNow:"LIVE",versus:"gegen",upNext:"ALS NÄCHSTES",allUpdates:"Alle Fan-Updates"},
 tr:{kicker:"FAN HQ · TAKIM MERKEZİ",title:"Takım Merkezin",description:"Bu takımın yaklaşan maçları ve en yeni taraftar güncellemeleri.",openFeed:"Fan HoopFeed'i aç",games:"Sonraki maçlar ve canlı skor",liveNow:"CANLI",versus:"rakip",upNext:"SIRADAKİ",allUpdates:"Tüm taraftar güncellemeleri"},
 pt:{kicker:"FAN HQ · CENTRO DA EQUIPA",title:"O centro da tua equipa",description:"Próximos jogos e as atualizações mais recentes dos fãs desta equipa.",openFeed:"Abrir Fan HoopFeed",games:"Próximos jogos e resultado em direto",liveNow:"AO VIVO",versus:"vs.",upNext:"A SEGUIR",allUpdates:"Todas as atualizações dos fãs"},
 it:{kicker:"FAN HQ · HUB SQUADRA",title:"Il tuo hub squadra",description:"Le prossime partite e gli ultimi aggiornamenti dei fan su questa squadra.",openFeed:"Apri Fan HoopFeed",games:"Prossime partite e punteggio live",liveNow:"IN DIRETTA",versus:"contro",upNext:"PROSSIMA",allUpdates:"Tutti gli aggiornamenti dei fan"},
 el:{kicker:"FAN HQ · ΚΕΝΤΡΟ ΟΜΑΔΑΣ",title:"Το κέντρο της ομάδας σου",description:"Επερχόμενοι αγώνες και οι τελευταίες ενημερώσεις φιλάθλων για αυτή την ομάδα.",openFeed:"Άνοιγμα Fan HoopFeed",games:"Επόμενοι αγώνες και ζωντανό σκορ",liveNow:"ΖΩΝΤΑΝΑ",versus:"εναντίον",upNext:"ΕΠΟΜΕΝΟ",allUpdates:"Όλες οι ενημερώσεις φιλάθλων"},
 ar:{kicker:"مركز الفريق · FAN HQ",title:"مركز فريقك",description:"المباريات القادمة وآخر تحديثات المشجعين لهذا الفريق.",openFeed:"فتح Fan HoopFeed",games:"المباريات القادمة والنتيجة المباشرة",liveNow:"مباشر الآن",versus:"ضد",upNext:"التالي",allUpdates:"كل تحديثات المشجعين"},
 ru:{kicker:"FAN HQ · ЦЕНТР КОМАНДЫ",title:"Центр вашей команды",description:"Предстоящие игры и последние обновления болельщиков этой команды.",openFeed:"Открыть Fan HoopFeed",games:"Следующие игры и текущий счёт",liveNow:"В ПРЯМОМ ЭФИРЕ",versus:"против",upNext:"ДАЛЕЕ",allUpdates:"Все обновления фанатов"},
 az:{kicker:"FAN HQ · KOMANDA MƏRKƏZİ",title:"Komanda mərkəzin",description:"Bu komandanın qarşıdakı oyunları və fanlardan ən son yeniliklər.",openFeed:"Fan HoopFeed-i aç",games:"Növbəti oyunlar və canlı hesab",liveNow:"CANLI",versus:"qarşı",upNext:"NÖVBƏTİ",allUpdates:"Bütün fan yenilikləri"},
 pl:{kicker:"FAN HQ · CENTRUM DRUŻYNY",title:"Centrum Twojej drużyny",description:"Nadchodzące mecze i najnowsze aktualności fanów tej drużyny.",openFeed:"Otwórz Fan HoopFeed",games:"Następne mecze i wynik na żywo",liveNow:"NA ŻYWO",versus:"przeciwko",upNext:"NASTĘPNIE",allUpdates:"Wszystkie aktualności fanów"},
 zh:{kicker:"粉丝专区 · 球队中心",title:"你的球队中心",description:"这支球队即将进行的比赛和最新粉丝动态。",openFeed:"打开粉丝 HoopFeed",games:"下一场比赛与实时比分",liveNow:"正在直播",versus:"对阵",upNext:"即将开始",allUpdates:"所有粉丝动态"},
 ja:{kicker:"ファンHQ · チームハブ",title:"あなたのチームハブ",description:"このチームの今後の試合と最新のファン情報。",openFeed:"ファンHoopFeedを開く",games:"次の試合とライブスコア",liveNow:"ライブ中",versus:"対",upNext:"次の試合",allUpdates:"すべてのファン情報"},
 sr:{kicker:"FAN HQ · CENTAR TIMA",title:"Centar tvog tima",description:"Predstojeće utakmice i najnovije objave navijača ovog tima.",openFeed:"Otvori Fan HoopFeed",games:"Sledeće utakmice i rezultat uživo",liveNow:"UŽIVO",versus:"protiv",upNext:"SLEDEĆE",allUpdates:"Sve objave navijača"},
 fi:{kicker:"FAN HQ · JOUKKUEKESKUS",title:"Joukkueesi keskus",description:"Tulevat ottelut ja tämän joukkueen uusimmat fanipäivitykset.",openFeed:"Avaa Fan HoopFeed",games:"Seuraavat ottelut ja live-tulos",liveNow:"LIVE",versus:"vastaan",upNext:"SEURAAVAKSI",allUpdates:"Kaikki fanipäivitykset"},
 he:{kicker:"FAN HQ · מרכז הקבוצה",title:"מרכז הקבוצה שלך",description:"המשחקים הקרובים ועדכוני האוהדים האחרונים של הקבוצה הזו.",openFeed:"פתיחת Fan HoopFeed",games:"המשחקים הבאים ותוצאה בזמן אמת",liveNow:"בשידור חי",versus:"נגד",upNext:"הבא בתור",allUpdates:"כל עדכוני האוהדים"},
 lt:{kicker:"FAN HQ · KOMANDOS CENTRAS",title:"Tavo komandos centras",description:"Artimiausios rungtynės ir naujausi šios komandos fanų įrašai.",openFeed:"Atidaryti Fan HoopFeed",games:"Kitos rungtynės ir tiesioginis rezultatas",liveNow:"GYVAI",versus:"prieš",upNext:"KITA",allUpdates:"Visi fanų įrašai"},
 uk:{kicker:"FAN HQ · ЦЕНТР КОМАНДИ",title:"Центр вашої команди",description:"Майбутні матчі та останні оновлення фанатів цієї команди.",openFeed:"Відкрити Fan HoopFeed",games:"Наступні матчі та рахунок наживо",liveNow:"НАЖИВО",versus:"проти",upNext:"ДАЛІ",allUpdates:"Усі оновлення фанатів"}
};


export default function FanTeamPosts({ teamId, teamType = "mens" }: { teamId:string; teamType?: "mens" | "womens" }) {
  const { language, formatDate, t } = useLanguage();
  const labels = fanTeamHubLabels[language] || fanTeamHubLabels.en;
  const ft = (key: Parameters<typeof fanFeedI18n>[0]) => fanFeedI18n(key, language);
  const [posts,setPosts] = useState<TeamFanPost[]>([]);
  const [games,setGames] = useState<TeamGame[]>([]);
  const [groupName,setGroupName] = useState("");
  useEffect(() => {
    let active=true;
    const load=async()=>{
      const now=new Date().toISOString();
      const [{data:gameRows},{data:group},{data:userResult}]=await Promise.all([
        supabase.from("fan_live_games").select("id,opponent_name,status,scheduled_at,started_at,home_score,away_score,period_label,league_name").eq("team_id",teamId).in("status",["scheduled","live","in_progress"]).order("scheduled_at",{ascending:true}).limit(10),
        supabase.from("team_fan_groups").select("group_name").eq("team_id",teamId).maybeSingle(),
        supabase.auth.getUser()
      ]);
      if(!active)return;
      setGroupName(group?.group_name || "Fan Group");
      const viewer=userResult.user;
      let postRows:any[]=[];
      if(viewer){
        const [{data:profile},{data:member},{data:moderator}]=await Promise.all([
          supabase.from("profiles").select("account_type").eq("id",viewer.id).maybeSingle(),
          supabase.from("team_fan_group_members").select("team_id").eq("team_id",teamId).eq("user_id",viewer.id).maybeSingle(),
          supabase.from("team_fan_group_moderators").select("team_id").eq("team_id",teamId).eq("user_id",viewer.id).maybeSingle()
        ]);
        if(profile?.account_type==="fan" && (member || moderator)){
          const {data:rows}=await supabase.from("team_fan_group_posts")
            .select("id,team_id,author_id,body,image_url,is_pinned,created_at,profiles:profiles!team_fan_group_posts_author_id_fkey(display_name,avatar_url)")
            .eq("team_id",teamId).eq("status","published").order("is_pinned",{ascending:false}).order("created_at",{ascending:false}).limit(3);
          postRows=await Promise.all((rows||[]).map(async(p:any)=>{
            const {data:signed}=p.image_url?await supabase.storage.from("fan-group-images").createSignedUrl(p.image_url,600):{data:null};
            return {...p,image_src:signed?.signedUrl||null,profiles:Array.isArray(p.profiles)?p.profiles[0]:p.profiles};
          }));
        }
      }
      setPosts(postRows as TeamFanPost[]);
      setGames(((gameRows||[]) as TeamGame[]).filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||Boolean(g.scheduled_at&&g.scheduled_at>=now)).slice(0,5));
    };
    void load(); const timer=window.setInterval(()=>void load(),30000);
    return () => { active=false; window.clearInterval(timer); };
  },[teamId,teamType]);
  if(!posts.length&&!games.length) return null;
  return <section className="dashboard-card" style={{marginTop:20,padding:20}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><p className="eyebrow">FAN HQ · TEAM HUB</p><h2 style={{marginBottom:4}}>Your Team Hub</h2><p className="muted">Upcoming games and posts from {groupName}.</p></div>
      <Link href="/fan-feed" className="btn">Open Fan HQ</Link>
    </div>
    {!!games.length&&<div style={{display:"grid",gap:10,marginTop:14}}><h3 style={{margin:0}}>Next games & live score</h3>{games.map(game=><article key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 14px",border:"1px solid var(--border)",borderRadius:12,background:"var(--paper)"}}><div><strong>{game.status==="live"||game.status==="in_progress"?"LIVE NOW":"vs. "+game.opponent_name}</strong><p className="muted" style={{margin:"4px 0 0",fontSize:12}}>{game.league_name||"Basketball"}{game.scheduled_at?" · "+new Date(game.scheduled_at).toLocaleString():""}{game.period_label?" · "+game.period_label:""}</p></div><strong style={{whiteSpace:"nowrap",fontSize:18}}>{game.home_score!=null&&game.away_score!=null?`${game.home_score} – ${game.away_score}`:"UP NEXT"}</strong></article>)}</div>}
    {!!posts.length&&<div style={{display:"grid",gap:14,marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>{groupName + " posts"}</h3><Link href="/fan-feed" style={{color:"var(--orange)",fontWeight:900}}>Open Fan HQ →</Link></div>{posts.map(post=><article key={post.id} style={{padding:"14px 0",borderTop:"1px solid var(--border)"}}><div style={{display:"flex",alignItems:"center",gap:10}}>{post.profiles?.avatar_url?<img src={post.profiles.avatar_url} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">F</div>}<div><Link href={"/fans/"+post.author_id}><strong>{post.profiles?.display_name||ft("fan")}</strong></Link><p className="muted" style={{margin:0,fontSize:12}}>{new Date(post.created_at).toLocaleString()}</p></div></div>{post.body&&<p style={{whiteSpace:"pre-wrap",lineHeight:1.6}}>{post.body}</p>}{post.image_src&&<img src={post.image_src} alt="Fan Group post" style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:12}}/>}{post.is_pinned&&<small className="muted">Pinned by a group moderator</small>}</article>)}</div>}
  </section>;
}
