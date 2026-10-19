import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HoopCheck",
    short_name: "HoopCheck",
    description: "Research coaches, professional basketball teams, and leagues worldwide.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F7F5",
    theme_color: "#FF5A1F",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
