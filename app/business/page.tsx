import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business Partnerships | HoopCheck™",
  description: "Explore sponsorship, strategic partnership, athlete ambassador, and private investor inquiry opportunities with HoopCheck™.",
};

const opportunities = [
  { id: "sponsors", title: "Sponsorships", eyebrow: "Brand visibility", description: "Reach basketball players and fans through clearly labeled, mutually approved campaigns. Packages and inventory are discussed individually.", href: "/sponsors", points: ["Social media collaborations", "Sponsored content and placements, subject to availability", "Campaign reporting and transparent deliverables"] },
  { id: "investors", title: "Investor inquiries", eyebrow: "Private discussion", description: "Request an introductory conversation about HoopCheck™ and its business plans. This page is not an offer to sell securities or a solicitation to invest.", href: "/investors", points: ["Company overview and product roadmap", "Verified operating and financial information", "Legal review before any investment terms are offered"] },
  { id: "strategic", title: "Strategic partnerships", eyebrow: "Build together", description: "Work with HoopCheck™ on basketball community development, athlete outreach, media, and commercial relationships.", href: "/partners", points: ["Clubs, leagues and agencies", "Basketball media and service providers", "Joint campaigns and product feedback"] },
  { id: "ambassadors", title: "Athlete ambassadors", eyebrow: "Player voices", description: "Help introduce HoopCheck™ to the basketball community through authentic, clearly disclosed promotions.", href: "/ambassadors", points: ["Custom campaign deliverables", "Referral arrangements when tracking is ready", "Independent and truthful player reviews"] },
];

export default function BusinessPartnershipsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
      <section className="rounded-3xl border border-orange-500/40 bg-zinc-950 px-6 py-12 text-white sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">HoopCheck™ · Business</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">Partner with the future of basketball.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">Discover ways to support the global basketball community through sponsorships, athlete partnerships, strategic collaboration, and private investor conversations.</p>
        <p className="mt-6 text-sm font-semibold text-orange-300">Know who you’re signing with.</p>
      </section>
      <nav aria-label="Partnership opportunities" className="mt-6 flex flex-wrap gap-3">
        {opportunities.map((item) => <a key={item.id} href={`#${item.id}`} className="rounded-full border border-current/20 px-4 py-2 text-sm font-semibold hover:border-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">{item.title}</a>)}
      </nav>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {opportunities.map((item) => (
          <section id={item.id} key={item.id} className="scroll-mt-24 rounded-2xl border border-current/20 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">{item.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold">{item.title}</h2>
            <p className="mt-3 leading-7 opacity-80">{item.description}</p>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 opacity-80">
              {item.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <Link href={item.href} className="mt-5 inline-flex rounded-full border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-500 hover:bg-orange-500 hover:text-black">Learn more →</Link>
          </section>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-current/20 p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Start a conversation</h2>
        <p className="mt-3 max-w-3xl leading-7 opacity-80">Partnership application and secure inquiry processing are being prepared. Until verified contact and submission channels are connected, this page does not collect personal or financial information. No sponsorship inventory, investment terms, or ambassador compensation is guaranteed by this page.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-orange-500 px-5 py-3 font-bold text-black hover:bg-orange-400">Explore HoopCheck™</Link>
      </section>
    </main>
  );
}
