import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Professional Basketball Teams Worldwide",
  description: "Explore HoopCheck's international professional basketball team directory. Search teams by country and league before considering an overseas basketball contract.",
  openGraph: {
    title: "Professional Basketball Teams Worldwide | HoopCheck",
    description: "Explore international professional basketball teams by country and league.",
  },
};

export default function TeamsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
