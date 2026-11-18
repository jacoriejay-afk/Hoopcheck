// Supplied by the app owner on 2026-11-18. This is a public application ID,
// not a signing credential. Matching the signed archive remains a release gate.
export const hoopcheckIosIdentifierPrefix = "Y778LM35G5";
export function appleAppSiteAssociation(prefix?: string) {
  const value = prefix === undefined ? hoopcheckIosIdentifierPrefix : prefix.trim();
  // An environment override may confirm the known prefix, never silently enable
  // a different or invented Apple application identity.
  if (value !== hoopcheckIosIdentifierPrefix) return null;
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
          { "/": "/team-hub/groups/*/*", exclude: true },
          { "/": "/teams/*/*", exclude: true },
          { "/": "/leagues/*/*", exclude: true },
          { "/": "/players/*/*", exclude: true },
          { "/": "/womens/leagues/*/*", exclude: true },
          { "/": "/womens/leagues/*" },
          { "/": "/womens/*/*", exclude: true },
          { "/": "/womens/leagues", exclude: true },
          ...["/", "/dashboard", "/feed", "/fan-feed", "/reels", "/search", "/notifications", "/account", "/account/edit", "/fan-live", "/team-hub/groups", "/team-hub/groups/*", "/settings", "/teams", "/teams/*", "/leagues", "/leagues/*", "/players", "/players/*", "/coaches", "/womens", "/womens/*"].map(path => ({ "/": path })),
        ],
      }],
    },
  };
}
