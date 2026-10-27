/**
 * HoopCheck native wrapper. This intentionally loads the existing production
 * Next.js site so the web app remains the single UI/codebase.
 *
 * Validate the remote-shell approach against store requirements before release.
 * Capacitor CLI accepts this plain configuration object without importing its
 * types, which keeps the existing web TypeScript check independent of native
 * packages until the platform toolchain is installed.
 */
const config = {
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
