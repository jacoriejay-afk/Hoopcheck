"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const items = [
  ["/feed","Feed","◉"],
  ["/search","Search","⌕"],
  ["/teams","Teams","▣"],
  ["/players","Players","🏀"],
  ["__PROFILE__","Profile","●"],

] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [profileHref, setProfileHref] = useState("/profile");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {\n      setSignedIn(Boolean(data.user));\n      if (data.user) {\n        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", data.user.id).maybeSingle();\n        setProfileHref(profile?.account_type === "player" ? `/players/${data.user.id}` : "/profile");\n      }\n    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {\n      setSignedIn(Boolean(session));\n      if (session?.user) {\n        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", session.user.id).maybeSingle();\n        setProfileHref(profile?.account_type === "player" ? `/players/${session.user.id}` : "/profile");\n      } else {\n        setProfileHref("/profile");\n      }\n    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!signedIn) return null;
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([href,label,icon]) => {
        const resolvedHref = href === "__PROFILE__" ? profileHref : href;\n        const active = pathname === resolvedHref || pathname.startsWith(resolvedHref + "/");
        return <Link key={href} href={resolvedHref} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <span className="bottom-nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>;
      })}
    </nav>
  );
}
