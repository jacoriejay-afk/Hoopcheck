import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";
import MobileAuth from "../components/MobileAuth";
import GlobalBackButton from "../components/GlobalBackButton";
import GlobalSearch from "../components/GlobalSearch";
import LanguageProvider from "../components/LanguageProvider";
import SignedInBar from "../components/SignedInBar";
import BottomNav from "../components/BottomNav";


function ProtectionLayer(){
  React.useEffect(()=>{
    const block=(e:Event)=>e.preventDefault();
    const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&((e.shiftKey&&["s","4","5"].includes(e.key.toLowerCase()))||e.key.toLowerCase()==="p"))e.preventDefault();};
    document.addEventListener("contextmenu",block); document.addEventListener("dragstart",block); document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("contextmenu",block);document.removeEventListener("dragstart",block);document.removeEventListener("keydown",key)};
  },[]); return null;
}
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
            <SignedInBar />
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
