"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession } from "../lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCachedSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <main className="hoopcheck-landing hc-rebrand">
      <section className="hc-hero">
        <div className="hc-hero-copy">
          <div className="hc-overline"><span className="hc-pulse" /> BUILT FOR THE INTERNATIONAL GAME</div>
          <h1>DON’T SIGN<br />IN THE <span>DARK.</span></h1>
          <p className="hc-hero-lede">Know who you’re signing with. Research teams, coaches, and leagues through the experiences of players who have been there.</p>
          <div className="hc-hero-actions">
            <Link href="/signup" className="hc-primary-cta">GET STARTED <span aria-hidden="true">↗</span></Link>
            <Link href="/login" className="hc-secondary-cta">I HAVE AN ACCOUNT</Link>
          </div>
          <div className="hc-hero-footnote"><span aria-hidden="true">●</span> Built for players navigating basketball worldwide</div>
        </div>
        <div className="hc-hero-art" aria-label="HoopCheck basketball court graphic">
          <div className="hc-art-label hc-art-label-top">YOUR CAREER. YOUR CALL.</div>
          <div className="hc-court">
            <div className="hc-court-midline" />
            <div className="hc-court-circle" />
            <div className="hc-court-key hc-court-key-left" />
            <div className="hc-court-key hc-court-key-right" />
            <div className="hc-court-arc hc-court-arc-left" />
            <div className="hc-court-arc hc-court-arc-right" />
            <div className="hc-court-ring"><span>HC</span></div>
          </div>
          <div className="hc-art-label hc-art-label-bottom"><span>01</span> RESEARCH BEFORE YOU COMMIT</div>
        </div>
      </section>

      <section className="hc-value-strip" aria-label="What you can research">
        <div><span>01</span><strong>TEAMS</strong><small>Check the organization</small></div>
        <div><span>02</span><strong>COACHES</strong><small>Understand who you’ll work with</small></div>
        <div><span>03</span><strong>LEAGUES</strong><small>Explore the market</small></div>
        <div><span>04</span><strong>PLAYER VOICES</strong><small>Learn from shared experience</small></div>
      </section>

      <section className="hc-proof-section" aria-labelledby="hc-proof-heading">
        <div className="hc-section-heading">
          <div><p className="hc-section-kicker">A CLOSER LOOK</p><h2 id="hc-proof-heading">THE DETAILS<br /><span>MATTER.</span></h2></div>
          <p>Basketball is global. Your due diligence should be, too. Explore the questions that matter before making your next move.</p>
        </div>
        <div className="hc-proof-grid">
          <div className="hc-topic-list">
            <div><span>01</span><strong>Payment experience</strong><span aria-hidden="true">↗</span></div>
            <div><span>02</span><strong>Communication & professionalism</strong><span aria-hidden="true">↗</span></div>
            <div><span>03</span><strong>Living arrangements & support</strong><span aria-hidden="true">↗</span></div>
            <div><span>04</span><strong>Day-to-day team experience</strong><span aria-hidden="true">↗</span></div>
          </div>
          <article className="hc-sample-review">
            <div className="hc-sample-top"><span className="hc-sample-dot" /> SAMPLE REVIEW <span className="hc-sample-tag">ILLUSTRATIVE</span></div>
            <div className="hc-sample-rating"><span>★★★★★</span><small>Example layout only</small></div>
            <h3>Know what to ask before you sign.</h3>
            <p>This sample shows the kinds of topics player feedback can cover. It is not a real review and does not describe any specific team or coach.</p>
            <div className="hc-sample-tags"><span>PAYMENT</span><span>COMMUNICATION</span><span>SUPPORT</span></div>
          </article>
        </div>
      </section>

      <section className="hc-steps-section" aria-labelledby="hc-steps-heading">
        <div className="hc-section-heading hc-steps-heading">
          <div><p className="hc-section-kicker">THE PLAYBOOK</p><h2 id="hc-steps-heading">THREE STEPS.<br /><span>MORE CONTEXT.</span></h2></div>
        </div>
        <div className="hc-steps-grid">
          <article><span className="hc-step-no">01 / SEARCH</span><div className="hc-step-icon" aria-hidden="true">⌕</div><h3>Find the name.</h3><p>Look up a professional team, coach, or league.</p></article>
          <article><span className="hc-step-no">02 / LEARN</span><div className="hc-step-icon" aria-hidden="true">◎</div><h3>Read experiences.</h3><p>Compare available perspectives and look for specifics.</p></article>
          <article><span className="hc-step-no">03 / DECIDE</span><div className="hc-step-icon" aria-hidden="true">↗</div><h3>Ask better questions.</h3><p>Use reviews as one input alongside your own due diligence.</p></article>
        </div>
      </section>

      <section className="hc-final-cta">
        <p className="hc-section-kicker">YOUR NEXT MOVE STARTS HERE</p>
        <h2>KNOW MORE.<br /><span>MOVE SMARTER.</span></h2>
        <p>Build your HoopCheck account and research your next opportunity with more context.</p>
        <div className="hc-hero-actions">
          <Link href="/signup" className="hc-primary-cta">JOIN HOOPCHECK <span aria-hidden="true">↗</span></Link>
          <Link href="/login" className="hc-secondary-cta">SIGN IN</Link>
        </div>
      </section>
    </main>
  );
}
