import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";
import MobileAuth from "../components/MobileAuth";
import GlobalBackButton from "../components/GlobalBackButton";
import GlobalSearch from "../components/GlobalSearch";
import LanguageProvider from "../components/LanguageProvider";
import BottomNav from "../components/BottomNav";
import ProtectionLayer from "../components/ProtectionLayer";

export const metadata: Metadata = {
  title: "HoopCheck",
  description: "Research coaches, professional basketball teams, and leagues worldwide.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><ProtectionLayer />
        <ThemeProvider>
          <LanguageProvider>
            <MobileAuth />
            <BottomNav />
            <GlobalBackButton />
            <div className="global-search-wrap">
              <Suspense fallback={null}>
                <GlobalSearch compact />
              </Suspense>
            </div>
            {children}
          </LanguageProvider>
        </ThemeProvider>

        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <p>Research the basketball world before you commit.</p>
            </div>
            <div className="footer-links">
              <div>
                <strong>Research</strong>
                <Link href="/search">Global Search</Link>
                <Link href="/coaches">Coaches</Link>
                <Link href="/teams">Teams</Link>
                <Link href="/leagues">Leagues</Link>
              </div>
              <div>
                <strong>Account</strong>
                <Link href="/login">Log In</Link>
                <Link href="/signup">Sign Up</Link>
                <Link href="/membership">Membership</Link>
                <Link href="/dashboard">Dashboard</Link>
              </div>
              <div>
                <strong>Legal</strong>
                <Link href="/terms">Terms of Service</Link>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/community-guidelines">Community Guidelines</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} HoopCheck. All rights reserved.</span>
            <span>Built for basketball players.</span>
          </div>
      </footer>
    </body>
  </html>
);
}
