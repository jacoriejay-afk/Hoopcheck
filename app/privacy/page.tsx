"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">HoopCheck Legal</div>
        <h1>Privacy<br />Policy.</h1>
        <p>This Privacy Policy explains what HoopCheck collects, why it is used, how it is shared, and the choices available to users.</p>
      </section>
      <section className="legal-content">
        <div className="legal-card">
          <p className="updated">Last updated: October 8, 2026</p>

          <h2>1. Scope</h2>
          <p>This policy applies to information processed through HoopCheck websites, applications, accounts, subscriptions, reviews, support interactions, and related services.</p>

          <h2>2. Information We Collect</h2>
          <p>Depending on how you use HoopCheck, we may collect account and profile information such as name, email address, account type, country, biography, team information, profile photo, preferences, reviews, ratings, reports, messages, and support requests.</p>
          <p>We may collect technical information such as IP address, device/browser information, session information, approximate location derived from technical data, security logs, and usage events where needed to operate, secure, and improve the service.</p>
          <p>Subscription records may include plan, subscription status, billing period, Stripe customer or subscription identifiers, and transaction-related information. HoopCheck does not intentionally store complete payment-card numbers in its application database.</p>

          <h2>3. Reviews and Public Information</h2>
          <p>Information you intentionally submit for public display, including reviews, ratings, profile information, or other public content, may be visible to other users according to the product's access rules.</p>
          <p>Do not put private or sensitive information about another person into a public review. HoopCheck may preserve a moderation or legal record even when public content is removed where reasonably necessary for safety, fraud prevention, dispute resolution, or legal compliance.</p>

          <h2>4. How We Use Information</h2>
          <ul>
            <li>Provide accounts, profiles, search, reviews, ratings, messaging, and other platform features.</li>
            <li>Authenticate users and protect accounts.</li>
            <li>Process subscriptions and billing.</li>
            <li>Moderate content and investigate reports.</li>
            <li>Detect fraud, abuse, manipulation, and security threats.</li>
            <li>Operate, troubleshoot, measure, and improve HoopCheck.</li>
            <li>Communicate service, security, billing, and legal notices.</li>
            <li>Comply with applicable legal obligations and enforce agreements.</li>
          </ul>

          <h2>5. Service Providers</h2>
          <p>HoopCheck may use third-party providers for hosting, database and authentication services, payments, identity verification, analytics, security, communications, storage, and other infrastructure. These providers receive information only as reasonably necessary for their services, subject to applicable agreements and law.</p>

          <h2>6. Supabase</h2>
          <p>HoopCheck uses Supabase for database, authentication, storage, and related application infrastructure. Information processed through Supabase may include account data, profiles, reviews, ratings, reports, preferences, and other platform data.</p>

          <h2>7. Stripe</h2>
          <p>HoopCheck uses Stripe for subscription billing and payment processing. Stripe may process payment, billing, fraud-prevention, and account information necessary to provide those services.</p>

          <h2>8. Identity Verification</h2>
          <p>Where enabled, eligible professional players may use an identity-verification process. HoopCheck may receive a verification result and limited information needed to administer a verification badge or status. Identity documents, selfies, biometric-related information, or other verification materials may be processed by the identity-verification provider and are subject to that provider's applicable policies.</p>
          <p>HoopCheck does not intentionally store identity-document or face-scan files in its ordinary application database when the verification provider handles those materials.</p>

          <h2>9. Cookies and Similar Technologies</h2>
          <p>HoopCheck may use cookies, local storage, session technologies, and similar mechanisms for authentication, preferences, security, functionality, and measurement. Some third-party providers may use their own technologies when integrated into the service.</p>

          <h2>10. When We Share Information</h2>
          <p>We may disclose information to service providers, to comply with valid legal process or applicable law, to protect users or HoopCheck, to investigate fraud or abuse, to enforce our Terms, or as part of a business transaction such as a merger, acquisition, financing, or sale of assets.</p>
          <p>We do not sell personal information merely because you use HoopCheck. If a future feature involves a legally defined sale or sharing of personal information, HoopCheck will provide the notices and choices required by applicable law.</p>

          <h2>11. International Processing</h2>
          <p>HoopCheck may be accessed internationally and information may be processed in countries other than the country where you live. Applicable privacy rights can vary by jurisdiction.</p>

          <h2>12. Data Retention</h2>
          <p>We retain information for as long as reasonably necessary for the purpose for which it was collected, including operating the service, maintaining legitimate business and payment records, preventing fraud and abuse, resolving disputes, enforcing agreements, maintaining security records, and complying with legal obligations. We aim to avoid retaining personal information longer than reasonably necessary for these purposes.</p>

          <h2>13. Account Deletion</h2>
          <p>You can request or initiate account deletion through the available HoopCheck account controls. When deletion is completed, user-owned account data and user-uploaded files are removed or de-identified according to the platform's deletion process.</p>
          <p>Some limited information may remain where retention is reasonably necessary for legal compliance, payment/accounting records, security, fraud prevention, dispute resolution, moderation integrity, or other lawful purposes. Retained records are not kept for ordinary product use after account deletion.</p>

          <h2>14. Privacy Rights</h2>
          <p>Depending on where you live and whether applicable law covers you, you may have rights to know or access information, request correction, request deletion, obtain a copy of certain information, object to or restrict certain processing, or opt out of certain sales/sharing or targeted advertising activities.</p>
          <p>For example, California law provides qualifying consumers rights that can include access, deletion, correction, and certain opt-out rights, subject to statutory exceptions. HoopCheck will evaluate requests under the law applicable to the requester and the service.</p>

          <h2>15. Privacy Requests</h2>
          <p>Use the HoopCheck Support page to submit a privacy or account request. We may need to verify your identity before fulfilling a request in order to protect accounts and personal information. We will respond within the time required by applicable law.</p>

          <h2>16. Security</h2>
          <p>HoopCheck uses technical and organizational measures intended to protect information, including access controls, authentication, encrypted network connections, database security controls, and limited administrative access. No online service can guarantee absolute security.</p>

          <h2>17. Children's Privacy</h2>
          <p>HoopCheck is not intended for children under 13, and we do not knowingly collect personal information from children under 13. Because HoopCheck is designed around professional basketball and career research, our account system is intended for adults.</p>

          <h2>18. Data Breaches and Security Incidents</h2>
          <p>If HoopCheck experiences a security incident involving personal information, we will assess the incident and provide notices or take other actions required by applicable law.</p>

          <h2>19. Changes to This Policy</h2>
          <p>We may update this Privacy Policy when our services, data practices, or legal obligations change. The updated version will be posted with a revised effective date.</p>

          <h2>20. Contact</h2>
          <p>For privacy questions, deletion requests, data-rights requests, or security concerns, use the HoopCheck Support page.</p>

          <div className="legal-footer">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/community-guidelines">Community Guidelines</Link>
            <Link href="/support">Privacy Support</Link>
            <Link href="/membership">Membership</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
