import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Sponsorships | HoopCheck™", description: "Explore proposed HoopCheck™ basketball sponsorship campaigns." };
const packages = [
  { name:"Starter", price:"$150 / month", items:["Sponsor directory recognition","One social Story per month","Monthly delivery summary"] },
  { name:"Growth", price:"$400 / month", items:["Starter benefits","One agreed social collaboration post","Tracked campaign link and reporting"] },
  { name:"Premier", price:"$1,000 / month", items:["Growth benefits","Up to two approved co-branded campaigns","Priority campaign planning"] },
];
export default function SponsorsPage() { return <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
  <Link href="/business" className="text-sm font-semibold text-orange-500">← Business partnerships</Link>
  <p className="mt-8 text-xs font-bold uppercase tracking-widest text-orange-500">HoopCheck™ Sponsorships</p>
  <h1 className="mt-3 text-4xl font-black">Reach the basketball community.</h1>
  <p className="mt-4 max-w-3xl leading-7 opacity-80">Explore introductory pilot campaigns for basketball brands and service providers. All prices and deliverables below are proposals, subject to available inventory, audience verification, and a signed agreement.</p>
  <div className="mt-8 grid gap-4 md:grid-cols-3">{packages.map(p=><section key={p.name} className="rounded-2xl border border-current/20 p-6"><h2 className="text-2xl font-bold">{p.name}</h2><p className="mt-2 text-xl font-semibold text-orange-500">{p.price}</p><ul className="mt-5 list-disc space-y-3 pl-5 text-sm">{p.items.map(i=><li key={i}>{i}</li>)}</ul></section>)}</div>
  <p className="mt-8 rounded-2xl border border-current/20 p-6 text-sm leading-7">Sponsors cannot buy favorable reviews, alter trust scores, or influence player-submitted ratings. Paid placements must be clearly disclosed. Secure applications and payment collection are not yet enabled on this page.</p>
<Link href="/partners" className="mt-6 inline-flex rounded-full bg-orange-500 px-5 py-3 font-bold text-black">Submit a sponsor inquiry</Link>
</main>; }