// Metro loads this configuration as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
const config = getSentryExpoConfig(__dirname);
// Share platform-neutral modules without loading alternate React/native dependency copies.
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../../lib/auth"),
  path.resolve(__dirname, "../../lib/billing"),
  path.resolve(__dirname, "../../lib/pre-sign"),
];
module.exports = config;
