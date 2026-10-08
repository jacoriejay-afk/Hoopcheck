"use client";

import Link from "next/link";

export default function PrivacyPage() {
return (
<main>
<section className="hero">
    <div className="eyebrow">
      HoopCheck Legal
    </div>
    <h1>
      Privacy
      <br />
      Policy.
    </h1>
    <p>
      This policy explains what information HoopCheck
      collects, how it is used, and the choices available
      to users.
    </p>
  </section>
  <section className="legal-content">
    <div className="legal-card">
      <p className="updated">
        Last updated: October 6, 2026
      </p>
      <h2>1. Information We Collect</h2>
      <p>
        When you use HoopCheck, we may collect information
        that you provide directly, including your name,
        email address, profile information, country,
        biography, reviews, ratings, reports, and other
        information you choose to submit.
      </p>
      <p>
        We may also collect information associated with your
        subscription, such as subscription status, plan,
        billing period, and payment-provider identifiers.
      </p>
      <h2>2. Account Information</h2>
      <p>
        When you create an account, HoopCheck may collect
        information necessary to authenticate your account
        and provide the service.
      </p>
      <p>
        Your account information may be used to provide
        account access, protect the platform, communicate
        with you, and maintain the security of HoopCheck.
      </p>
      <h2>3. Reviews and User Content</h2>
      <p>
        If you submit a review, rating, report, profile
        description, or other content, that information may
        be stored by HoopCheck and displayed according to
        the features and access rules of the platform.
      </p>
      <p>
        Reviews may be associated with your HoopCheck
        profile or display name depending on the platform's
        current design and applicable settings.
      </p>
      <h2>4. Payment Information</h2>
      <p>
        HoopCheck uses Stripe to process subscription
        payments.
      </p>
      <p>
        HoopCheck does not intentionally store complete
        payment card numbers on its own application
        database. Payment information is handled through
        Stripe's payment infrastructure.
      </p>
      <p>
        Stripe may process payment and billing information
        according to Stripe's own privacy practices and
        applicable policies.
      </p>
      <h2>5. How We Use Information</h2>
      <p>
        HoopCheck may use collected information to:
      </p>
      <ul>
        <li>Provide and operate the HoopCheck platform.</li>
        <li>Authenticate users and protect accounts.</li>
        <li>Process subscriptions and payments.</li>
        <li>Display ratings, reviews, and research information.</li>
        <li>Moderate and investigate reported content.</li>
        <li>Prevent fraud, abuse, and unauthorized activity.</li>
        <li>Improve platform features and performance.</li>
        <li>Communicate important service information.</li>
        <li>Comply with applicable legal obligations.</li>
      </ul>
      <h2>6. Supabase</h2>
      <p>
        HoopCheck uses Supabase for application services
        including database infrastructure and
        authentication.
      </p>
      <p>
        Information stored through Supabase may include
        account information, profiles, reviews, ratings,
        reports, subscription records, and other information
        necessary to operate HoopCheck.
      </p>
      <h2>7. Stripe</h2>
      <p>
        HoopCheck uses Stripe for subscription billing and
        payment processing.
      </p>
      <p>
        Stripe may process information necessary to complete
        payments, manage subscriptions, prevent fraud, and
        provide billing services.
      </p>
      <h2>8. Identity Verification</h2>
      <p>
        Players may choose to use HoopCheck's secure identity
        verification flow to confirm a professional-player
        identity. HoopCheck uses Stripe Identity to check a
        government ID or passport and, when configured, compare
        the document with a live selfie.
      </p>
      <p>
        HoopCheck does not intentionally store the face scan or
        government identity document in its application
        database. Stripe may process identity information and
        verification images under Stripe's identity and privacy
        terms. HoopCheck receives the verification result needed
        to determine whether the player account can receive a
        verification badge.
      </p>
      <h2>8. Cookies and Local Storage</h2>
      <p>
        HoopCheck may use cookies, browser storage, session
        information, or similar technologies necessary to
        authenticate users, maintain sessions, remember
        preferences, and operate the platform.
      </p>
      <p>
        Some technologies may be provided by third-party
        services used to operate HoopCheck.
      </p>
      <h2>9. Information Sharing</h2>
      <p>
        HoopCheck may share information with service
        providers that help operate the platform, including
        infrastructure, authentication, payment processing,
        security, analytics, and hosting providers.
      </p>
      <p>
        HoopCheck may also disclose information when
        reasonably necessary to comply with applicable law,
        legal process, protect users, protect the platform,
        investigate fraud or abuse, or enforce our Terms.
      </p>
      <h2>10. Public Information</h2>
      <p>
        Information that you intentionally submit for public
        display may become visible to other HoopCheck users.
      </p>
      <p>
        Do not submit information to a public review or
        profile that you do not want other users to see.
      </p>
      <h2>11. Review Privacy</h2>
      <p>
        HoopCheck is designed to allow players to share
        professional experiences with coaches, teams, and
        leagues.
      </p>
      <p>
        Users should not include private personal
        information, home addresses, private phone numbers,
        private email addresses, financial information, or
        other sensitive information about another person in
        a review.
      </p>
      <h2>12. Data Security</h2>
      <p>
        HoopCheck uses technical and organizational measures
        designed to protect information against unauthorized
        access, alteration, disclosure, or destruction.
      </p>
      <p>
        However, no internet service or electronic storage
        system can guarantee absolute security.
      </p>
      <h2>13. Data Retention</h2>
      <p>
        HoopCheck may retain information for as long as
        reasonably necessary to provide the service, maintain
        business records, prevent abuse, resolve disputes,
        enforce agreements, or satisfy legal obligations.
      </p>
      <h2>14. Account Deletion</h2>
      <p>
        Users may request deletion of their account and
        associated personal information by contacting
        HoopCheck through the contact method provided by the
        service.
      </p>
      <p>
        Some information may need to be retained when
        required for legal, security, fraud-prevention,
        financial, or recordkeeping purposes.
      </p>
      <h2>15. Children's Privacy</h2>
      <p>
        HoopCheck is intended for adults and professional
        basketball users. Users under 18 should not create
        an account or use paid services without appropriate
        legal authorization.
      </p>
      <h2>16. International Users</h2>
      <p>
        HoopCheck may be accessed by users in different
        countries. Information may therefore be processed or
        stored in countries other than the country where a
        user lives.
      </p>
      <p>
        Users are responsible for reviewing the privacy
        rights and requirements applicable in their
        jurisdiction.
      </p>
      <h2>17. Your Privacy Choices</h2>
      <p>
        Depending on your location and applicable law, you
        may have rights concerning your personal information,
        including rights to access, correct, delete, or
        restrict certain uses of your information.
      </p>
      <p>
        Requests can be submitted through the contact method
        provided by HoopCheck.
      </p>
      <h2>18. Changes to This Policy</h2>
      <p>
        HoopCheck may update this Privacy Policy when the
        service, technology, or applicable legal requirements
        change.
      </p>
      <p>
        Updated versions will be posted on this page with a
        revised effective date.
      </p>
      <h2>19. Contact</h2>
      <p>
        For privacy questions, account deletion requests, or
        other privacy-related concerns, contact HoopCheck
        through the contact method provided by the service.
      </p>
      <div className="legal-footer">
        <Link href="/terms">
          Terms of Service
        </Link>
        <Link href="/community-guidelines">
          Community Guidelines
        </Link>
        <Link href="/membership">
          Membership
        </Link>
      </div>
    </div>
  </section>
</main>

);
}
