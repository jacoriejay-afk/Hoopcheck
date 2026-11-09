import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Investor Relations | HoopCheck™", description: "Private investor introduction information for HoopCheck™." };
export default function InvestorsPage(){return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
<Link href="/business" className="text-sm font-semibold text-orange-500">← Business partnerships</Link>
<p className="mt-8 text-xs font-bold uppercase tracking-widest text-orange-500">HoopCheck™ Investor Relations</p>
<h1 className="mt-3 text-4xl font-black">Build the future of basketball information.</h1>
<p className="mt-5 leading-7 opacity-80">HoopCheck™ is developing a global platform for basketball discovery, community and player experiences. Interested parties may explore an introductory conversation when a verified contact channel becomes available.</p>
<section className="mt-8 rounded-2xl border border-current/20 p-6"><h2 className="text-xl font-bold">Information prepared for qualified discussions</h2><ul className="mt-4 list-disc space-y-2 pl-5 leading-7"><li>Company and founder overview</li><li>Product roadmap and verified traction</li><li>Revenue model and operating assumptions</li><li>Use of funds, financial risks and capitalization</li><li>Legal and compliance review before any offering</li></ul></section>
<p className="mt-8 text-sm leading-7 opacity-80">This page is informational only. It is not an offer to sell or solicitation to buy securities. No valuation, ownership percentage, investment return, or funding round is being offered here. No financial information is collected through this page.</p>
<p className="mt-5 text-sm opacity-80">For an introductory conversation only, sign in to use the existing inquiry form. Please do not submit financial statements, banking details or confidential investment materials.</p><Link href="/partners" className="mt-5 inline-flex rounded-full bg-orange-500 px-5 py-3 font-bold text-black">Request an introduction</Link>
</main>}