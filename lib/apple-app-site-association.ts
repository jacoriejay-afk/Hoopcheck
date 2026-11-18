export function appleAppSiteAssociation(prefix: string | undefined) {
  const value = prefix?.trim();
  // Use the ApplicationIdentifierPrefix from the signed iOS app, not an App
  // Store numeric ID, Expo project UUID, guessed team or a browser-supplied ID.
  if (!value || !/^[A-Z0-9]{10}$/.test(value)) return null;
  return {
    applinks: {
      details: [{
        appIDs: [`${value}.online.hoopcheck.app`],
        components: [
          // Browser OAuth, recovery, referral capture and unimplemented nested
          // pages keep their browser session/cookie flow.
          { "/": "/auth/*", exclude: true },
          { "/": "/reset-password", exclude: true },
          { "/": "/referral/*", exclude: true },
          { "/": "/r/*", exclude: true },
          { "/": "/teams/*/*", exclude: true },
          { "/": "/leagues/*/*", exclude: true },
          { "/": "/players/*/*", exclude: true },
          { "/": "/womens/leagues/*/*", exclude: true },
          { "/": "/womens/leagues/*" },
          { "/": "/womens/*/*", exclude: true },
          { "/": "/womens/leagues", exclude: true },
          ...["/", "/dashboard", "/feed", "/fan-feed", "/reels", "/search", "/notifications", "/account", "/settings", "/teams", "/teams/*", "/leagues", "/leagues/*", "/players", "/players/*", "/coaches", "/womens", "/womens/*"].map(path => ({ "/": path })),
        ],
      }],
    },
  };
}
