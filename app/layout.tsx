import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Graduate, Inter } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import "./hoopcheck-rebrand.css";
import "./hoopcheck-polish.css";
import "./hoopcheck-final-overrides.css";
import "./hoopcheck-preview-system.css";
import "./hoopcheck-player-profile.css";
import "./hoopcheck-directory-profile.css";
import "./hoopcheck-surface-contract.css";
import "./hoopcheck-responsive-layout.css";
import "./hoopcheck-theme-tokens.css";
import "./hoopcheck-directory-card-fixes.css";
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
import CourtLines from "../components/CourtLines";

const displayFont = Graduate({ variable: "--font-display", subsets: ["latin"], weight: "400", display: "swap" });
const sansFont = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://hoopcheck.online").replace(/\/$/, "");
const defaultTitle = "HoopCheck — Know Who You're Signing With";
const defaultDescription = "Real reviews of basketball teams, coaches, leagues and agents, written by players. Check the team before you sign.";
const socialImage = "/hoopcheck-logo.svg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | HoopCheck" },
  description: defaultDescription,
  applicationName: "HoopCheck",
  keywords: [
    "HoopCheck", "overseas basketball", "professional basketball teams",
    "basketball coach reviews", "basketball league reviews", "basketball agents",
    "international basketball", "basketball player experiences",
  ],
  openGraph: {
    type: "website",
    siteName: "HoopCheck",
    title: defaultTitle,
    description: defaultDescription,
    url: siteUrl,
    images: [{ url: socialImage, alt: "HoopCheck — Know Who You're Signing With" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [socialImage],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HoopCheck", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/hoopcheck-app-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A1F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const savedLanguage = cookieStore.get("hoopcheck-language")?.value;
  const rawSavedTheme = cookieStore.get("hoopcheck-theme")?.value;
  const initialTheme = rawSavedTheme === "dynamic" ? "dark" : rawSavedTheme === "dark" || rawSavedTheme === "light" || rawSavedTheme === "system" ? rawSavedTheme : "system";
  const supportedLanguages = ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar", "ru", "az", "pl", "zh", "ja", "sr", "fi", "he", "lt", "uk"] as const;
  const initialLanguage = supportedLanguages.includes(savedLanguage as (typeof supportedLanguages)[number]) ? savedLanguage as (typeof supportedLanguages)[number] : "en";
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HoopCheck",
    url: siteUrl,
    logo: new URL(socialImage, siteUrl).toString(),
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HoopCheck",
    url: siteUrl,
    description: defaultDescription,
  };

  return (
    <html lang={initialLanguage} dir={initialLanguage === "ar" ? "rtl" : "ltr"} className={`${displayFont.variable} ${sansFont.variable} ${initialTheme === "dark" ? "theme-dark" : "theme-light"}`} suppressHydrationWarning>
      <head><Script id="hoopcheck-theme-init" strategy="beforeInteractive">{`(function(){try{var root=document.documentElement;var m=document.cookie.match(/(?:^|;\\s*)hoopcheck-theme=([^;]+)/);var cookie=m?decodeURIComponent(m[1]):null;var stored=localStorage.getItem("hoopcheck-theme");var pref=stored||cookie||"${initialTheme}";if(pref==="dynamic")pref="dark";if(pref!=="dark"&&pref!=="light"&&pref!=="system")pref="system";var dark=pref==="dark"||(pref==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);root.classList.toggle("theme-dark",dark);root.classList.toggle("theme-light",!dark);root.style.colorScheme=dark?"dark":"light";if(stored!==pref)localStorage.setItem("hoopcheck-theme",pref);if(cookie!==pref)document.cookie="hoopcheck-theme="+encodeURIComponent(pref)+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}})();`}</Script></head>
      <body className={sansFont.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }} />
        <ProtectionLayer />
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider>
            <LanguageProvider initialLanguage={initialLanguage}>
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
          <CourtLines variant="full-court" className="hc-court-footer-art" />
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
