import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business Opportunities | HoopCheck™",
  description: "Explore athlete ambassador, sponsorship, strategic partnership, and investor conversations with HoopCheck™.",
};

const opportunities = [
  {
    title: "Athlete ambassadors",
    description: "Help introduce HoopCheck™ to basketball communities through authentic content, education, and referrals.",
    details: "Discuss campaign expectations, audience fit, content rights, and any proposed referral compensation before an agreement is signed.",
  },
  {
    title: "Sponsors",
    description: "Support basketball-focused campaigns, community initiatives, and responsible brand collaborations.",
    details: "Share your brand, campaign goals, audience, budget range, and preferred timeline.",
  },
  {
    title: "Strategic partners",
    description: "Explore collaborations with teams, leagues, agents, coaches, and basketball organizations.",
    details: "Tell us what your organization does and how a partnership could benefit the basketball community.",
  },
  {
    title: "Investors",
    description: "Start a confidential conversation about HoopCheck™ and its long-term business direction.",
    details: "An inquiry is not an offer of securities or a promise of returns. Any investment requires separate review and documentation.",
  },
] as const;

export default function BusinessOpportunitiesPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 text-[color:var(--foreground)] sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">Work with HoopCheck™</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Build a better-connected basketball community.</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8">
        We welcome thoughtful conversations with athletes, brands, basketball organizations, and prospective investors.
        Choose the opportunity that best fits your goals.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {opportunities.map((item) => (
          <section key={item.title} className="rounded-2xl border border-orange-500/40 bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="text-xl font-bold">{item.title}</h2>
            <p className="mt-3 leading-7">{item.description}</p>
            <p className="mt-4 text-sm leading-6 opacity-80">{item.details}</p>
            <Link href="/partners" className="mt-5 inline-flex rounded-xl border border-orange-500 px-4 py-2 font-semibold text-orange-500 hover:bg-orange-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
              Start a conversation
            </Link>
          </section>
        ))}
      </div>
      <section className="mt-10 rounded-2xl border border-orange-500/30 p-6">
        <h2 className="text-xl font-bold">How inquiries work</h2>
        <p className="mt-3 leading-7">
          Use our existing business inquiry form and describe the opportunity you are interested in.
          Account sign-in may be required depending on inquiry availability.
          Submitting an inquiry does not establish a partnership, ambassador appointment, or investment relationship.
        </p>
        <Link href="/partners" className="mt-4 inline-block font-semibold text-orange-500 underline underline-offset-4">Open the business inquiry form</Link>
      </section>
      <nav aria-label="Company information" className="mt-8 flex flex-wrap gap-5 underline underline-offset-4">
        <Link href="/about">About</Link><Link href="/founder">Founder</Link><Link href="/company">Company</Link>
      </nav>
    </main>
  );
}
