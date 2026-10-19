import type { Metadata, Viewport } from "next";
import { Graduate, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import "./hoopcheck-rebrand.css";
import "./hoopcheck-polish.css";
import "./hoopcheck-final-overrides.css";
import "./hoopcheck-preview-system.css";
import ThemeProvider from "../components/ThemeProvider";
import AuthProvider from "../components/AuthProvider";
import MobileAuth from "../components/MobileAuth";
import GlobalBackButton from "../components/GlobalBackButton";
import LanguageProvider from "../components/LanguageProvider";
import BottomNav from "../components/BottomNav";
import ProtectionLayer from "../components/ProtectionLayer";
import AnalyticsTracker from "../components/AnalyticsTracker";
import SiteHeader from "../components/SiteHeader";
import Logo from "../components/Logo";

const displayFont = Graduate({ variable: "--font-display", subsets: ["latin"], weight: "400", display: "swap" });
const sansFont = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hoopcheck-nine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HoopCheck | Overseas Basketball Team & Coach Reviews",
    template: "%s | HoopCheck",
  },
  description: "Research professional basketball teams, coaches, and leagues worldwide. Learn from player experiences before signing an overseas basketball contract.",
  applicationName: "HoopCheck",
  keywords: [
    "HoopCheck",
    "overseas basketball",
    "professional basketball teams",
    "basketball coach reviews",
    "basketball league reviews",
    "international basketball",
    "basketball player experiences",
  ],
  openGraph: {
    type: "website",
    siteName: "HoopCheck",
    title: "HoopCheck | Overseas Basketball Team & Coach Reviews",
    description: "Research professional basketball teams, coaches, and leagues worldwide before you sign.",
  },
  twitter: {
    card: "summary",
    title: "HoopCheck | Overseas Basketball Team & Coach Reviews",
    description: "Research professional basketball teams, coaches, and leagues worldwide before you sign.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HoopCheck",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/hoopcheck-app-icon.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/hoopcheck-app-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A1F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className={sansFont.className}><ProtectionLayer />
        <ThemeProvider>
          <AuthProvider>
          <LanguageProvider>
            <AnalyticsTracker />
            <SiteHeader />
            <MobileAuth />
            <BottomNav />
            <GlobalBackButton />
            {children}
          </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>

        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link href="/" className="footer-logo" aria-label="HoopCheck home"><Logo variant="full" size={42} /></Link>
              <p>Research the basketball world before you commit.</p>
            </div>
            <div className="footer-links">
              <div>
                <strong>HoopCheck</strong>
                <span className="muted">Account required for member access.</span>
                <Link href="/membership">Membership</Link>
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
