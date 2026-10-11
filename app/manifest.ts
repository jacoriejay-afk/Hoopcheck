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
    background_color: "#10151f",
    theme_color: "#ff6a00",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/hoopcheck-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
