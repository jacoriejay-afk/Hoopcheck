import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/directory" } };

export default function SeoLayout({ children }: { children: React.ReactNode }) { return children; }
