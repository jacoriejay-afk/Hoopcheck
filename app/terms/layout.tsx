import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service", description: "Read the HoopCheck terms governing accounts, subscriptions, reviews and basketball community features.", alternates: { canonical: "/terms" } };

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
