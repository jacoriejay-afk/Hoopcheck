import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hoop: {
          orange: "#FF5500",
          orangeHover: "#D64400",
          matteBlack: "#0D0D0D",
          charcoal: "#1A1A1A",
          offWhite: "#F8F9FA",
          cardWhite: "#FFFFFF",
          borderGray: "#EDEDED",
          textDark: "#111111",
        },
      },
    },
  },
  plugins: [],
};

export default config;
