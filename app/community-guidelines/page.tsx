"use client";

import Link from "next/link";

export default function CommunityGuidelinesPage() {
return (
<main>
<nav className="nav">
  <Link href="/" className="logo">
    Hoop<span>Check</span>
  </Link>
    <div className="links">
      <Link href="/search">Search</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/membership" className="btn">
        Membership
      </Link>
    </div>
  </nav>
  <section className="hero">
    <div className="eyebrow">
      HoopCheck Community
    </div>
    <h1>
      Community
      <br />
      Guidelines.
    </h1>
    <p>
      Honest experiences. Professional discussion.
      A better basketball community.
    </p>
  </section>
  <section className="legal-content">
    <div className="legal-card">
      <p className="updated">
        Last updated: October 2, 2026
      </p>
      <h2>1. Our Purpose</h2>
      <p>
        HoopCheck exists to help basketball players make
        better-informed decisions about coaches, professional
        teams, and leagues around the world.
      </p>
      <p>
        The platform depends on players sharing genuine
        professional experiences while treating other people
        with fairness and respect.
      </p>
      <h2>2. Genuine Experiences Only</h2>
      <p>
        Reviews must be based on your own genuine,
        first-hand experience with the coach, team, or league
        being reviewed.
      </p>
      <p>
        Do not submit reviews about experiences you did not
        personally have.
      </p>
      <h2>3. No Fake Reviews</h2>
      <p>
        Users may not create fake reviews, purchase reviews,
        sell reviews, submit reviews for another person, or
        coordinate with others to artificially influence a
        rating.
      </p>
      <p>
        Creating multiple accounts for the purpose of
        manipulating ratings or reviews is prohibited.
      </p>
      <h2>4. Be Honest and Specific</h2>
      <p>
        When possible, describe what happened and provide
        useful context rather than making unsupported
        accusations.
      </p>
      <p>
        Users are encouraged to distinguish between their
        personal experiences, opinions, and factual claims.
      </p>
      <h2>5. No Harassment</h2>
      <p>
        Criticism of a professional experience is allowed,
        but harassment, personal attacks, threats, stalking,
        intimidation, and targeted abuse are not allowed.
      </p>
      <h2>6. No Threats or Extortion</h2>
      <p>
        Users may not threaten another person with negative
        reviews, exposure, financial harm, or other
        consequences in order to obtain money, employment,
        playing time, contract changes, or other benefits.
      </p>
      <h2>7. Protect Private Information</h2>
      <p>
        Do not publish private or sensitive information about
        another person.
      </p>
      <p>
        This includes private phone numbers, home addresses,
        private email addresses, financial information,
        passwords, identification documents, medical
        information, or other information that should not be
        publicly shared.
      </p>
      <h2>8. No Hate or Discrimination</h2>
      <p>
        HoopCheck does not allow content that attacks or
        promotes discrimination against people based on
        protected characteristics.
      </p>
      <h2>9. No Spam or Advertising</h2>
      <p>
        Reviews and platform features may not be used for
        spam, unsolicited advertising, promotional campaigns,
        referral schemes, or unrelated commercial activity.
      </p>
      <h2>10. No Illegal Content</h2>
      <p>
        Users may not submit content that promotes or
        facilitates unlawful activity.
      </p>
      <h2>11. Professional Disputes</h2>
      <p>
        Players may describe legitimate professional
        experiences involving contracts, communication,
        payment, development, professionalism, or other
        basketball-related matters.
      </p>
      <p>
        However, users should avoid presenting allegations
        that they cannot reasonably support as established
        facts.
      </p>
      <h2>12. Payment and Contract Reviews</h2>
      <p>
        Users may discuss their own experiences involving
        payment or contractual matters.
      </p>
      <p>
        Do not publish another person's private financial
        information, banking details, identification
        information, or confidential documents.
      </p>
      <h2>13. Review Manipulation</h2>
      <p>
        Coaches, teams, leagues, agents, players, and other
        individuals must not manipulate HoopCheck ratings by
        organizing fake positive or negative reviews.
      </p>
      <p>
        Users should not create or coordinate groups for the
        purpose of artificially increasing or decreasing a
        rating.
      </p>
      <h2>14. Reporting Reviews</h2>
      <p>
        If you believe a review violates these guidelines,
        use the Report Review feature available on the
        platform.
      </p>
      <p>
        Reports should be made honestly and should not be
        submitted simply because someone disagrees with a
        review.
      </p>
      <h2>15. Moderation</h2>
      <p>
        HoopCheck may review reported content and take
        appropriate moderation action.
      </p>
      <p>
        Possible actions include approving, rejecting,
        flagging, restricting, or removing content.
      </p>
      <p>
        HoopCheck may also restrict or terminate accounts
        involved in repeated or serious violations.
      </p>
      <h2>16. Appeals and Corrections</h2>
      <p>
        If a user believes moderation action was taken in
        error, HoopCheck may provide an opportunity to request
        review or correction through the available contact
        process.
      </p>
      <h2>17. No Retaliation</h2>
      <p>
        Users should not retaliate against another person for
        submitting an honest review or making a good-faith
        report.
      </p>
      <h2>18. Reviews Are Not Endorsements</h2>
      <p>
        A review reflects the experience and opinion of the
        individual who submitted it.
      </p>
      <p>
        A rating does not represent an endorsement or
        guarantee by HoopCheck.
      </p>
      <h2>19. Legal Requests</h2>
      <p>
        HoopCheck may respond to valid legal requests or
        obligations concerning platform content and user
        information.
      </p>
      <h2>20. Changes to These Guidelines</h2>
      <p>
        These Community Guidelines may be updated as
        HoopCheck grows and as platform rules or applicable
        laws change.
      </p>
      <div className="legal-footer">
        <Link href="/terms">
          Terms of Service
        </Link>
        <Link href="/privacy">
          Privacy Policy
        </Link>
        <Link href="/membership">
          Membership
        </Link>
        <Link href="/search">
          Research
        </Link>
      </div>
    </div>
  </section>
</main>

);
}
