/**
 * HoopCheck Capacitor staging prototype.
 *
 * Requires an isolated HTTPS staging origin. There is no production fallback.
 * The hosted Next.js server/API architecture remains unchanged.
 */
import { requireCapacitorStagingOrigin } from "./lib/capacitor-staging-origin.ts";

const staging = requireCapacitorStagingOrigin(process.env.CAPACITOR_SERVER_URL);

const config = {
  appId: "online.hoopcheck.app",
  appName: "HoopCheck",
  webDir: "out",
  server: {
    url: staging.origin,
    cleartext: false,
    // Exact host only. External auth/payment flows need explicit handling.
    allowNavigation: [staging.hostname],
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
