import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/reviews" } };

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
