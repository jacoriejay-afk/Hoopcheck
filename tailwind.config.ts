const config = {
  // Keep Tailwind's dark: utilities aligned with the same root theme class.
  darkMode: ["class", '[class~="theme-dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--hc-foreground)",
        paper: "var(--hc-page-bg)",
        brand: {
          orange: "var(--hc-orange)",
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
        display: ["var(--font-display)", "Graduate", "serif"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
