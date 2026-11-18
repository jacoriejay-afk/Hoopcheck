// Metro loads this configuration as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
const config = getSentryExpoConfig(__dirname);
// Share the small, platform-neutral auth policy with the website and API. Keep
// normal Expo module resolution; no alternate React/native dependency copies.
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "../../lib/auth")];
module.exports = config;
