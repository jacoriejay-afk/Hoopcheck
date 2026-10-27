import type { CapacitorConfig } from "@capacitor/cli";

/**
 * HoopCheck native wrapper. This intentionally loads the existing production
 * Next.js site so the web app remains the single UI/codebase.
 *
 * Validate the remote-shell approach against store requirements before release.
 */
const config: CapacitorConfig = {
  appId: "online.hoopcheck.app",
  appName: "HoopCheck",
  webDir: "out",
  server: {
    url: "https://hoopcheck.online",
    cleartext: false,
    allowNavigation: ["hoopcheck.online", "*.hoopcheck.online"],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0A",
    },
  },
};

export default config;
