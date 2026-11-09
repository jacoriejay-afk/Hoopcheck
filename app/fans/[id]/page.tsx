"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import FollowButton from "../../../components/FollowButton";
import FanConnectionButton from "../../../components/FanConnectionButton";
import HoopLoading from "../../../components/HoopLoading";
import { useLanguage } from "../../../components/LanguageProvider";
import { fanDirectoryCopy } from "../i18n";
import "../fans.css";

export default function FanProfilePage() {
  const params = useParams<{id:string}>();
  const { language } = useLanguage();
  const copy = fanDirectoryCopy(language);
  const [fan,setFan] = useState<any>(null);
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("profiles")
          .select("id,display_name,username,avatar_url,bio")
          .eq("id", params.id)
          .eq("account_type", "fan")
          .maybeSingle();
        if (error) throw error;
        if (active) setFan(data);
      } catch (error) {
        console.error("Unable to load fan profile:", error);
        if (active) setFan(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params.id]);

  if (loading) return <main className="page-shell hc-fan-profile-page"><div className="page-container"><HoopLoading label={copy.profileLoading} /></div></main>;
  if (!fan) return <main className="page-shell hc-fan-profile-page"><div className="page-container"><section className="hero-card"><h1>{copy.unavailable}</h1><Link href="/fans" className="btn">{copy.back}</Link></section></div></main>;

  return <main className="page-shell hc-fan-profile-page"><div className="page-container">
    <section className="hc-fan-profile-hero">
      <div className="hc-fan-profile-avatar">{fan.avatar_url ? <img src={fan.avatar_url} alt=""/> : "F"}</div>
      <div className="hc-fan-profile-heading"><p className="eyebrow">{copy.profileKicker}</p><h1>{fan.display_name || fan.username || copy.fanFallback}</h1><p className="muted">@{fan.username || copy.handleFallback}</p></div>
    </section>
    <section className="dashboard-card hc-fan-profile-card" style={{marginTop:14}}>
      <p>{fan.bio || copy.bioFallback}</p>
      <div className="hc-fan-profile-actions"><FollowButton targetType="fan" targetId={fan.id}/><FanConnectionButton fanId={fan.id}/></div>
    </section>
  </div></main>;
}
