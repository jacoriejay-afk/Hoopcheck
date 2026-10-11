import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Professional Basketball Coach Directory",
  description: "Explore the HoopCheck professional basketball coach directory and research coaching connections as part of your overseas basketball due diligence.",
  openGraph: {
    title: "Professional Basketball Coach Directory | HoopCheck",
    description: "Explore professional basketball coaches as part of your overseas basketball research.",
  },
};

export default function CoachesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
