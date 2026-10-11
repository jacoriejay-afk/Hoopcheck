import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Basketball Research Search",
  description: "Search HoopCheck's basketball directory to explore professional teams, coaches, and leagues around the world.",
  openGraph: {
    title: "Global Basketball Research Search | HoopCheck",
    description: "Search professional basketball teams, coaches, and leagues around the world.",
  },
};

export default function SearchLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
