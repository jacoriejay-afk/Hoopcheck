import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HoopCheck",
    short_name: "HoopCheck",
    description: "Research basketball teams, coaches, leagues, and player experiences worldwide.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#111318",
    theme_color: "#111318",
    icons: [
      {
        src: "/hoopcheck-pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
