module.exports = ({ config }) => ({
  ...config,
  ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, HoopcheckPublicSystemLinksEnabled: process.env.EXPO_PUBLIC_HOOPCHECK_SYSTEM_LINKS_ENABLED === "true" } },
  plugins: [
    ...config.plugins,
    "./plugins/withAlternateIcons.cjs",
    ["@sentry/react-native/expo", {
      url: "https://sentry.io/",
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }],
  ],
});
