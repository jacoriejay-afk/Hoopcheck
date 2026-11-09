"use client";

import Link from "next/link";
import "./hoopcheck-brand-home.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";
import CategoryTile, { type CategoryTileKind } from "../components/CategoryTile";
import SearchBar from "../components/SearchBar";
import { HoopIcon } from "../components/HoopCheckUI";
import HomeDirectoryStats from "../components/HomeDirectoryStats";
import HomeDesktopIdentity from "../components/HomeDesktopIdentity";

const categories:{label:string;subtitle:string;href:string;category:CategoryTileKind}[]=[
 {label:"Men’s Teams",subtitle:"Research teams before you sign",href:"/teams",category:"teams"},
 {label:"Women’s Teams",subtitle:"Explore women’s basketball",href:"/womens",category:"womens"},
 {label:"Coaches",subtitle:"Check coaching reputations",href:"/coaches",category:"coaches"},
 {label:"Leagues",subtitle:"Compare competitions",href:"/leagues",category:"leagues"},
 {label:"Players",subtitle:"Discover basketball players",href:"/players",category:"players"},
 {label:"Reviews",subtitle:"Real feedback from basketball players",href:"/reviews",category:"reviews"},
 {label:"Alerts",subtitle:"Follow important updates",href:"/notifications",category:"alerts"}
];

export default function Home(){
 const router=useRouter();
 useEffect(()=>{getCachedSession().then(({data})=>{if(data.session)router.replace("/dashboard");});},[router]);
 useEffect(()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const nodes=Array.from(document.querySelectorAll<HTMLElement>(".hc-ia-door,.hc-d3-membership-band"));nodes.forEach((node,index)=>{node.classList.add("hc-d3-reveal");node.style.transitionDelay=`${Math.min(index,4)*.06}s`;});const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.12});nodes.forEach(node=>observer.observe(node));return()=>observer.disconnect();},[]);
 return <main className="hc-template-home hc-home-redesign hc-ia-home hc-ia-public-home">
   <div className="hc-d3-desktop-only"><HomeDesktopIdentity/></div>
   <div className="page-container">
   <div className="hc-d3-mobile-only">
   <SearchBar className="hc-ia-search" name="q" placeholder="Search teams, coaches, leagues, or players" ariaLabel="Search basketball directory"/>
   <header className="hc-ia-welcome"><p className="eyebrow">THE GLOBAL BASKETBALL INTELLIGENCE HUB</p><h1>KNOW WHO YOU’RE SIGNING WITH<span>.</span></h1><p className="muted">Explore teams, coaches, leagues, and real basketball experiences. Built for players and fans worldwide.</p><div className="hc-home-hero-actions"><Link href="/signup" className="hc-template-cta hc-home-cta">CREATE YOUR ACCOUNT <HoopIcon name="arrow-right" size={17}/></Link><Link href="/login" className="hc-home-signin">SIGN IN <HoopIcon name="arrow-up-right" size={15}/></Link></div></header>
   <Link href="/live-games" className="hc-ia-live-strip"><span className="hc-ia-live-dot"/><span><strong>LIVE GAMES</strong><small>See live and upcoming games</small></span><span>Open hub <HoopIcon name="arrow-right" size={16}/></span></Link>
   <HomeDirectoryStats />
   <Link href="/pre-sign" className="hc-smooth-presign-link"><strong>PRE-SIGN CHECK</strong><span>Six essential checks before signing a basketball contract</span><HoopIcon name="arrow-right" size={18}/></Link>
   </div>
   <div className="hc-d3-desktop-search"><SearchBar className="hc-ia-search" name="q" placeholder="Search teams, coaches, leagues, or players" ariaLabel="Search basketball directory"/></div>
   <div className="hc-d3-desktop-only"><Link href="/pre-sign" className="hc-smooth-presign-link"><strong>PRE-SIGN CHECK</strong><span>Research the club before you commit</span><HoopIcon name="arrow-right" size={18}/></Link></div>
   <section className="hc-ia-section"><div className="hc-ia-section-heading"><div><p className="eyebrow">YOUR NEXT MOVE</p><h2>EXPLORE HOOPCHECK</h2></div><Link href="/directory">All directories <HoopIcon name="arrow-right" size={15}/></Link></div><div className="hc-template-category-grid hc-home-category-grid hc-ia-door-grid">{categories.map(category=><CategoryTile key={category.label} label={category.label} category={category.category} href={category.href} description={category.subtitle} className="hc-home-category-tile"/>)}</div></section>
   <div className="hc-d3-live-band hc-d3-desktop-only"><Link href="/live-games"><span>LIVE GAMES</span><span>OPEN THE HUB →</span></Link></div>
   <section className="hc-d3-membership-band hc-d3-desktop-only"><Link href="/membership"><span>MEMBERSHIP</span><span>EXPLORE OPTIONS →</span></Link></section>
 </div></main>;
}
