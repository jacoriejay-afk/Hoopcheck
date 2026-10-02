import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
title: “HoopCheck”,
description:
“Research coaches, professional basketball teams, and leagues worldwide.”,
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
{children}

    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            Hoop<span>Check</span>
          </Link>
          <p>
            Research the basketball world
            before you commit.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <strong>Research</strong>
            <Link href="/search">
              Global Search
            </Link>
            <Link href="/coaches">
              Coaches
            </Link>
            <Link href="/teams">
              Teams
            </Link>
            <Link href="/leagues">
              Leagues
            </Link>
          </div>
          <div>
            <strong>Account</strong>
            <Link href="/login">
              Log In
            </Link>
            <Link href="/signup">
              Sign Up
            </Link>
            <Link href="/membership">
              Membership
            </Link>
            <Link href="/dashboard">
              Dashboard
            </Link>
          </div>
          <div>
            <strong>Legal</strong>
            <Link href="/terms">
              Terms of Service
            </Link>
            <Link href="/privacy">
              Privacy Policy
            </Link>
            <Link href="/community-guidelines">
              Community Guidelines
            </Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} HoopCheck.
          All rights reserved.
        </span>
        <span>
          Built for basketball players.
        </span>
      </div>
    </footer>
    <style jsx global>{`
      .site-footer {
        margin-top: 80px;
        background: #080808;
        border-top: 1px solid #292929;
      }
      .footer-inner {
        max-width: 1180px;
        margin: 0 auto;
        padding: 55px 24px;
        display: grid;
        grid-template-columns: 1fr 1.5fr;
        gap: 70px;
      }
      .footer-brand {
        max-width: 320px;
      }
      .footer-logo {
        color: #fff;
        font-size: 30px;
        font-weight: 1000;
        letter-spacing: -0.04em;
        text-decoration: none;
      }
      .footer-logo span {
        color: var(--orange);
      }
      .footer-brand p {
        color: #777;
        line-height: 1.6;
        margin-top: 15px;
      }
      .footer-links {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 35px;
      }
      .footer-links > div {
        display: flex;
        flex-direction: column;
        gap: 11px;
      }
      .footer-links strong {
        color: var(--orange);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 5px;
      }
      .footer-links a {
        color: #aaa;
        font-size: 13px;
        text-decoration: none;
        transition: color 0.2s ease;
      }
      .footer-links a:hover {
        color: var(--orange);
      }
      .footer-bottom {
        max-width: 1180px;
        margin: 0 auto;
        padding: 20px 24px 30px;
        border-top: 1px solid #202020;
        display: flex;
        justify-content: space-between;
        gap: 20px;
        color: #666;
        font-size: 11px;
      }
      @media (max-width: 800px) {
        .footer-inner {
          grid-template-columns: 1fr;
          gap: 40px;
        }
      }
      @media (max-width: 600px) {
        .footer-inner {
          padding: 45px 16px;
        }
        .footer-links {
          grid-template-columns: repeat(2, 1fr);
          gap: 30px 20px;
        }
        .footer-bottom {
          padding-left: 16px;
          padding-right: 16px;
          flex-direction: column;
        }
      }
    `}</style>
  </body>
</html>

);
}

### One important note
This adds the footer **globally**, so you don't have to manually add legal links to every page.
Save → commit to GitHub → **don't deploy yet**.
Reply **Done** and we'll move to the next launch-protection step.
