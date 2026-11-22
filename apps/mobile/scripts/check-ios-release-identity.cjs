#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS EAS preflight runs directly with Node, without a TypeScript loader. */
"use strict";

/** Explicit opt-in release prerequisite, NOT an EAS build command.
 * Historical builds were issued under two bundle IDs. Never quietly choose
 * a new signing identity, or let a Build 9 EAS prompt do it for you.
 */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));

function hold(reason) {
  console.error("BUILD 9 HOLD: " + reason);
  process.exitCode = 2;
}
const approved = (process.env.HOOPCHECK_APPROVED_IOS_BUNDLE_ID || "").trim();
if (!approved) {
  hold("Set HOOPCHECK_APPROVED_IOS_BUNDLE_ID to the Apple-approved identifier after checking App Store Connect and existing installs. Historic builds used both com.online.hoopcheck.app and online.hoopcheck.app.");
} else if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(approved)) {
  hold("The approved identifier is malformed.");
} else if (app.ios?.bundleIdentifier !== approved) {
  hold("Current app.json iOS identity " + String(app.ios?.bundleIdentifier) + " differs from explicitly approved " + approved + ". Do not create alternate signing credentials.");
} else if (app.extra?.eas?.projectId !== "62f822cb-ab9a-42ba-8456-007d2822ef70") {
  hold("EAS project identity differs from the documented HoopCheck project.");
} else if (!app.ios?.associatedDomains?.includes("applinks:hoopcheck.online")) {
  hold("Expected universal-link associated domain is missing.");
} else if (eas.cli?.appVersionSource !== "remote" || eas.cli?.requireCommit !== true) {
  hold("EAS remote versioning and immutable commit gates must remain enabled.");
} else if (eas.build?.production?.autoIncrement !== true || eas.build?.production?.environment !== "production") {
  hold("Production EAS build profile is not locked to remote autoIncrement and production environment.");
} else if (!eas.submit?.production?.ios?.ascAppId) {
  hold("App Store Connect application ID is missing.");
} else {
  console.log("Build 9 iOS identity checks passed for the expressly approved bundle identifier.");
  console.log("NOT TestFlight-ready: real iPhone startup, freeze regression, Apple Sandbox, privacy migration and signing capabilities still require acceptance.");
}
