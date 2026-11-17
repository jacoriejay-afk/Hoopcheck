module.exports = ({ config }) => ({
  ...config,
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
