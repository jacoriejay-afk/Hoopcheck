import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy", description: "Learn how HoopCheck handles personal information, privacy choices and account data.", alternates: { canonical: "/privacy" } };

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
