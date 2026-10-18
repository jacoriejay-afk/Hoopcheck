import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#F7F7F5",
        brand: {
          orange: "#FF5A1F",
        },
        category: {
          teams: "#FF5A1F",
          womens: "#E84393",
          coaches: "#2456C8",
          leagues: "#1E9E50",
          players: "#6C3FD4",
          reviews: "#0A0A0A",
          alerts: "#F5B800",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo Black", "Anton", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
