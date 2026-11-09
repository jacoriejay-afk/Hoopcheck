"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";
import { supabase } from "../lib/supabase";
import Logo from "./Logo";

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4.5 4.5" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21c.4-4.4 3-6.7 7.5-6.7s7.1 2.3 7.5 6.7Z" /></svg>; }

export default function SiteHeader() {
  const pathname=usePathname();const {signedIn,userId}=useAuthState();const {t}=useLanguage();const [menuOpen,setMenuOpen]=useState(false);const [accountType,setAccountType]=useState("");const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{let live=true;if(!userId){setAccountType("");return;}void Promise.all([supabase.from("profiles").select("account_type").eq("id",userId).maybeSingle(),supabase.rpc("get_current_user_admin_role")]).then(([profile,role])=>{if(live){setAccountType(profile.data?.account_type||"");setIsAdmin(role.data==="admin"||role.data==="moderator");}});return()=>{live=false};},[userId]);
  if(pathname.startsWith("/admin"))return null;
  const closeMenu=()=>setMenuOpen(false);const active=(href:string)=>pathname===href||pathname.startsWith(href+"/");
  const links=[{href:"/dashboard",label:"Home"},{href:"/search",label:"Search"},{href:"/directory",label:"Explore"},{href:"/teams",label:"Men’s Teams"},{href:"/womens",label:"Women’s Teams"},{href:"/coaches",label:"Coaches"},{href:"/leagues",label:"Leagues"},{href:"/players",label:"Players"},{href:"/reviews",label:"Reviews"},{href:"/about",label:"About"},{href:"/founder",label:"Founder"},{href:"/company",label:"Company"},{href:"/business",label:"Business"},{href:"/live-games",label:"Live Games"},{href:accountType==="fan"?"/fan-feed":"/feed",label:"HoopFeed"},...(signedIn?[...(accountType==="fan"?[{href:"/team-hub",label:"Team Hub"},{href:"/fans",label:"Find Fan"}]:[]),...(accountType==="player"||accountType==="scout"||accountType==="agent"?[{href:"/connections",label:"Connections"}]:[]),...(accountType==="coach"?[{href:"/coach-placement",label:"Coach Placement"}]:[]),{href:"/notifications",label:"Alerts"},{href:"/account",label:"Account"},...(isAdmin?[{href:"/admin/directory",label:"Admin"},{href:"/admin/business",label:"Business Inbox"}]:[])]:[{href:"/notifications",label:"Alerts"}])];
  return <header className="site-header-global hc-template-header">
    <Link href={signedIn?"/dashboard":"/"} className="site-header-brand" aria-label="HoopCheck home"><Logo variant="full" size={42} title="HoopCheck™"/></Link>
    <button type="button" className="hc-mobile-menu-toggle" aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span/><span/><span/></button>
    <nav className={menuOpen?"hc-header-nav is-open":"hc-header-nav"} aria-label="Primary navigation">
      <div className="hc-header-links">
        <div className="hc-header-mobile-links">{links.filter(item=>item.href!=="/players"||!signedIn||(accountType!==""&&accountType!=="fan")).map(item=><Link key={item.href} href={item.href} className={active(item.href)?"is-active":""} onClick={closeMenu}>{item.label}</Link>)}</div>
        <div className="hc-header-desktop-links">
          {links.filter(item=>["/dashboard","/search","/directory","/live-games"].includes(item.href)).map(item=><Link key={item.href} href={item.href} className={active(item.href)?"is-active":""}>{item.label}</Link>)}
          <details className="hc-header-more"><summary>More <span aria-hidden="true">▾</span></summary><div className="hc-header-more-panel">
            {links.filter(item=>!["/dashboard","/search","/directory","/live-games"].includes(item.href)&& (item.href!=="/players"||!signedIn||(accountType!==""&&accountType!=="fan"))).map(item=><Link key={item.href} href={item.href} className={active(item.href)?"is-active":""}>{item.label}</Link>)}
          </div></details>
        </div>
      </div>
      <div className="hc-header-actions"><Link href="/search" className="hc-header-icon" aria-label={t("search")} onClick={closeMenu}><SearchIcon/></Link>{!signedIn&&<Link href="/login" className="hc-signin-button" onClick={closeMenu}>SIGN IN <span aria-hidden="true">↗</span></Link>}<Link href={signedIn?"/account":"/login"} className="hc-header-icon" aria-label={signedIn?"Account":"Sign in"} onClick={closeMenu}><UserIcon/></Link></div>
    </nav>
  </header>;
}
