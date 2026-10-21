import type { Metadata, Viewport } from "next";
import { Graduate, Inter } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import "./globals.css";
import "./hoopcheck-rebrand.css";
import "./hoopcheck-polish.css";
import "./hoopcheck-final-overrides.css";
import "./hoopcheck-preview-system.css";
import "./hoopcheck-player-profile.css";
import AuthProvider from "../components/AuthProvider";
import MobileAuth from "../components/MobileAuth";
import GlobalBackButton from "../components/GlobalBackButton";
import BottomNav from "../components/BottomNav";
import PreferencesProvider, { type Language, type ThemePreference } from "../components/PreferencesProvider";
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
  const savedTheme = cookieStore.get("hoopcheck-theme")?.value;
  const savedLanguage = cookieStore.get("hoopcheck-language")?.value;
  let serverPreferences: { theme_preference?: string; preferred_language?: string } | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Root layouts may render in a read-only Server Component context.
          }
        },
      },
    });
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user) {
      const { data } = await serverSupabase.from("profiles").select("theme_preference,preferred_language").eq("id", user.id).maybeSingle();
      serverPreferences = data;
    }
  }
  const profileTheme = serverPreferences?.theme_preference;
  const profileLanguage = serverPreferences?.preferred_language;
  const cookieThemeValid = savedTheme === "light" || savedTheme === "dark" || savedTheme === "system";
  const cookieLanguageValid = ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar"].includes(savedLanguage || "");
  const initialTheme: ThemePreference = profileTheme === "dark" || profileTheme === "light"
    ? profileTheme
    : cookieThemeValid ? savedTheme as ThemePreference : profileTheme === "system" ? "system" : "system";
  const initialLanguage: Language = profileLanguage && ["en", "es", "fr", "de", "tr", "pt", "it", "el", "ar"].includes(profileLanguage)
    ? (profileLanguage === "en" && cookieLanguageValid && savedLanguage !== "en" ? savedLanguage as Language : profileLanguage as Language)
    : cookieLanguageValid ? savedLanguage as Language : "en";
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
    <html lang={initialLanguage} dir={initialLanguage === "ar" ? "rtl" : "ltr"} data-theme={initialTheme === "dark" ? "dynamic" : "light"} className={`${displayFont.variable} ${sansFont.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("hoopcheck-theme")||document.cookie.split("; ").find(function(c){return c.indexOf("hoopcheck-theme=")===0})?.split("=")[1]||"system";var d=t==="dark"||t==="dynamic"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dynamic":"light";document.documentElement.style.colorScheme=d?"dark":"light";var l=localStorage.getItem("hoopcheck-language")||decodeURIComponent(document.cookie.split("; ").find(function(c){return c.indexOf("hoopcheck-language=")===0})?.split("=").slice(1).join("=")||"en");document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}catch(e){document.documentElement.dataset.theme="light";}})();` }} />
      </head>
      <body className={sansFont.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }} />
        <PreferencesProvider initialTheme={initialTheme} initialLanguage={initialLanguage}>
          <ProtectionLayer />
          <AuthProvider>
              <AnalyticsTracker />
              <SiteHeader />
              <MobileAuth />
              <BottomNav />
              <GlobalBackButton />
              {children}
          </AuthProvider>
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
        </PreferencesProvider>
      </body>
    </html>
  );
}
