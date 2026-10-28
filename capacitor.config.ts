/**
 * HoopCheck Capacitor staging prototype.
 *
 * Fail closed: native commands must not silently package the live production
 * site. Set CAPACITOR_SERVER_URL to the exact HTTPS staging origin before
 * running Capacitor. Production origin and wildcard navigation are rejected.
 * The hosted Next.js server/API architecture remains unchanged.
 */
const productionOrigin = "https://hoopcheck.online";
const configuredUrl = process.env.CAPACITOR_SERVER_URL?.trim();

if (!configuredUrl) {
  throw new Error(
    "CAPACITOR_SERVER_URL is required. Set it to the dedicated HTTPS staging origin; production packaging is blocked by default.",
  );
}

let stagingUrl: URL;
try {
  stagingUrl = new URL(configuredUrl);
} catch {
  throw new Error("CAPACITOR_SERVER_URL must be a valid absolute HTTPS URL.");
}

if (
  stagingUrl.protocol !== "https:" ||
  stagingUrl.username ||
  stagingUrl.password ||
  stagingUrl.pathname !== "/" ||
  stagingUrl.search ||
  stagingUrl.hash
) {
  throw new Error(
    "CAPACITOR_SERVER_URL must be an HTTPS origin only (no credentials, path, query, or fragment).",
  );
}

if (stagingUrl.origin === productionOrigin || stagingUrl.hostname === "hoopcheck.online" || stagingUrl.hostname.endsWith(".hoopcheck.online")) {
  throw new Error(
    "Production HoopCheck hosts are blocked for the native staging prototype. Use a dedicated staging hostname outside hoopcheck.online.",
  );
}

const config = {
  appId: "online.hoopcheck.app",
  appName: "HoopCheck",
  webDir: "out",
  server: {
    url: stagingUrl.origin,
    cleartext: false,
    // Exact host only. External auth/payment flows should use the system
    // browser and an explicit, separately reviewed callback implementation.
    allowNavigation: [stagingUrl.hostname],
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
