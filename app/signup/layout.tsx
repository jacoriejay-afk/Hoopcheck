import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Free Account",
  description: "Join HoopCheck for free. Create a player, fan, coach, agent, scout or team-manager account and connect with the global basketball community.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
