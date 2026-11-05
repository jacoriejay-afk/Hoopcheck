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
        src: "/icons/hoopcheck-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/hoopcheck-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/hoopcheck-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}