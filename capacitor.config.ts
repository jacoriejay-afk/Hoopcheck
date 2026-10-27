import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.hoopcheck.app",
  appName: "HoopCheck",
  webDir: "out",
  server: {
    // The live Next.js site is dynamic and cannot safely be exported as a
    // static bundle without a dedicated compatibility audit. This URL is for
    // development/bootstrap only; review the App Store build architecture
    // before shipping a remote-only wrapper.
    url: "https://hoopcheck.online",
    cleartext: false,
    allowNavigation: ["hoopcheck.online", "*.hoopcheck.online"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0A0A0A",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0A",
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
    },
  },
};

export default config;
