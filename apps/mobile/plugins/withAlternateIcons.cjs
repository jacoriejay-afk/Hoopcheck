/* eslint-disable @typescript-eslint/no-require-imports -- Expo config plugins run in CommonJS. */
const { withDangerousMod, withInfoPlist, withXcodeProject, IOSConfig } = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

// Only the surrounding plate changes. The genuine Classic asset is composited
// unchanged in proportion; no tracing, recolouring, or regenerated logo artwork.
const icons = { Blackout: "#101014", Orange: "#FF793D" };
module.exports = function withAlternateIcons(config) {
  config = withInfoPlist(config, config => {
    const alternates = Object.fromEntries(Object.keys(icons).map(name => [name, { CFBundleIconName: name, CFBundleIconFiles: [name], UIPrerenderedIcon: false }]));
    for (const key of ["CFBundleIcons", "CFBundleIcons~ipad"]) config.modResults[key] = { ...config.modResults[key], CFBundleAlternateIcons: alternates };
    return config;
  });
  config = withXcodeProject(config, config => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const item of Object.values(configurations)) {
      if (item && typeof item === "object" && item.buildSettings?.PRODUCT_NAME) {
        item.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = '"Blackout Orange"';
        item.buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = "YES";
      }
    }
    return config;
  });
  return withDangerousMod(config, ["ios", async config => {
    const sourceRoot = IOSConfig.Paths.getSourceRoot(config.modRequest.projectRoot);
    const source = path.join(config.modRequest.projectRoot, "assets", "app-icon.png");
    for (const [name, background] of Object.entries(icons)) {
      const directory = path.join(sourceRoot, "Images.xcassets", `${name}.appiconset`);
      await fs.mkdir(directory, { recursive: true });
      await sharp(source).resize(864, 864).extend({ top: 80, bottom: 80, left: 80, right: 80, background }).flatten({ background }).png().toFile(path.join(directory, "Icon.png"));
      await fs.writeFile(path.join(directory, "Contents.json"), JSON.stringify({ images: [{ filename: "Icon.png", idiom: "universal", platform: "ios", size: "1024x1024" }], info: { author: "expo", version: 1 } }));
    }
    return config;
  }]);
};
