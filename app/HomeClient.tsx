"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";
import SearchBar from "../components/SearchBar";
import HomeDirectoryStats from "../components/HomeDirectoryStats";
import { HoopIcon, type HoopIconName } from "../components/HoopCheckUI";
import "./hoopcheck-brand-home.css";

const destinations: { title: string; detail: string; href: string; icon: HoopIconName }[] = [
  { title: "Men's teams", detail: "Research clubs worldwide", href: "/teams", icon: "shield-check" },
  { title: "Women's teams", detail: "Explore the women's game", href: "/womens", icon: "users" },
  { title: "Players", detail: "Discover player profiles", href: "/players", icon: "user" },
  { title: "Coaches", detail: "Know the people leading teams", href: "/coaches", icon: "clipboard-check" },
  { title: "Leagues", detail: "Explore global competitions", href: "/leagues", icon: "trophy" },
  { title: "Reviews", detail: "Learn from player experiences", href: "/reviews", icon: "star" },
];

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    getCachedSession().then(({ data }) => {
      if (active && data.session) router.replace("/dashboard");
    }).catch(() => {});
    return () => { active = false; };
  }, [router]);

  return (
    <main className="hc-new-home min-h-screen bg-[#0b1019] text-white">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">


        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#202b3d] via-[#111b2b] to-[#0b1019] px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[.22em] text-orange-400">The global basketball network</p>
            <h1 className="max-w-3xl text-4xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-6xl">Know who you're <span className="text-orange-400">signing with.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">Discover teams, research leagues, learn from real player experiences, and connect with the basketball world—all in one place.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-400">Get started <HoopIcon name="arrow-right" size={17}/></Link>
              <Link href="/teams" className="inline-flex min-h-12 items-center rounded-xl border border-white/25 px-6 py-3 font-bold text-white hover:bg-white/10">Explore teams</Link>
            </div>
          </div>
        </section>

        <section aria-label="Search the basketball directory" className="relative z-10 mx-auto mt-5 max-w-4xl rounded-2xl border border-white/15 bg-[#172234] p-3 sm:p-4">
          <SearchBar className="hc-ia-search" name="q" placeholder="Search teams, players, coaches, leagues..." ariaLabel="Search the basketball directory" />
        </section>

        <section className="mt-9"><HomeDirectoryStats /></section>

        <section className="mt-12" aria-labelledby="hc-explore-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Find your next move</p><h2 id="hc-explore-heading" className="mt-2 text-2xl font-black sm:text-3xl">Explore basketball</h2></div>
            <Link href="/directory" className="text-sm font-semibold text-orange-300 hover:text-orange-200">All directories →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {destinations.map(item => (
              <Link key={item.href} href={item.href} className="group flex min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-[#172234] p-4 transition hover:-translate-y-0.5 hover:border-orange-400/60 hover:bg-[#202e43] sm:p-5">
                <div className="flex items-start justify-between"><span className="rounded-xl bg-orange-500/15 p-2 text-orange-400"><HoopIcon name={item.icon} size={22}/></span><span aria-hidden="true" className="text-slate-400 group-hover:text-orange-300">↗</span></div>
                <div><h3 className="mt-4 font-bold text-white">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">{item.detail}</p></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label="Featured HoopCheck tools">
          <Link href="/pre-sign" className="group rounded-3xl border border-orange-400/25 bg-gradient-to-br from-orange-500/20 to-[#172234] p-6 hover:border-orange-400">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-300">For players</p><h2 className="mt-3 text-2xl font-black">Research before you sign.</h2><p className="mt-3 text-sm leading-6 text-slate-200">Use Pre-Sign Check to explore important questions about a club before making your next move.</p><span className="mt-6 inline-block font-bold text-orange-300">Explore Pre-Sign Check →</span>
          </Link>
          <Link href="/live-games" className="group rounded-3xl border border-white/10 bg-[#172234] p-6 hover:border-orange-400/60">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-300">For the community</p><h2 className="mt-3 text-2xl font-black">The game doesn't stop at tip-off.</h2><p className="mt-3 text-sm leading-6 text-slate-200">Explore live and upcoming games, fan conversations, and basketball community features.</p><span className="mt-6 inline-block font-bold text-orange-300">Open Live Game Hub →</span>
          </Link>
        </section>

        <section className="mt-12 rounded-3xl border border-white/10 bg-[#172234] p-6 text-center sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Your basketball world, connected</p><h2 className="mx-auto mt-3 max-w-xl text-2xl font-black sm:text-3xl">Built for players, fans, coaches, agents, and clubs.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-200">Find the information and community that matter to your role. Explore publicly, then create an account for your personalized experience.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/membership" className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:bg-white/10">View memberships</Link><Link href="/signup" className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-400">Create an account</Link></div>
        </section>
      </div>
    </main>
  );
}
