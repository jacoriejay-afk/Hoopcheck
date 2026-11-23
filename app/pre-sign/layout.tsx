import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pre-Sign Check for Basketball Players",
  description: "Six practical checks before signing a professional basketball contract. Research the club, player experiences, payment reliability, roster and contract terms.",
  alternates: { canonical: "/pre-sign" },
};

export default function PreSignLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
