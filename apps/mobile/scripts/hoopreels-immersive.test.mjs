import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

function loadCard() {
  const source = read("../components/HoopReelCard.tsx");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, "Reel card must parse as TSX");
  const exports = {};
  const stub = {
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "react-native": {
      Pressable: "Pressable", StyleSheet: { absoluteFill: {} },
      Text: "Text", View: "View",
    },
    "./FeedMedia": { FeedMedia: "FeedMedia" },
  };
  vm.runInNewContext(compiled.outputText, { exports, require: name => stub[name] || require(name) });
  return exports.HoopReelCard;
}

const post = {
  id: "22222222-2222-4222-8222-222222222222",
  author_id: "33333333-3333-4333-8333-333333333333",
  body: "Real game highlights", video_url: "private/reference.mp4",
  created_at: "2026-11-23T18:00:00Z",
  profiles: { display_name: "Basketball creator", account_type: "player" },
};

test("HoopReels preauthorizes only the virtualized window and plays one active video; tap-pausing does not clear its signed media", async () => {
  const Card = loadCard();
  const received = [];
  const props = {
    post, userId: "44444444-4444-4444-8444-444444444444", height: 620,
    active: true, ready: true, canWrite: true, check: { count: 7, mine: false },
    saved: false, checkBusy: false, saveBusy: false, blockBusy: false,
    onBack: () => {}, onCreate: () => received.push("create"), onViewPlayer: () => received.push("player"), onCheck: () => received.push("check"),
    onComments: () => {}, onShare: () => {}, onSave: () => {},
    onReport: () => received.push("report"), onHide: () => {},
    onHideCreator: () => {}, onBlockCreator: () => received.push("block"),
  };
  let tree;
  await act(async () => { tree = create(React.createElement(Card, props)); });
  const media = () => tree.root.findByType("FeedMedia").props;
  const button = label => tree.root.findAllByType("Pressable").find(element => element.props.accessibilityLabel === label);
  assert.equal(media().enabled, true);
  assert.equal(media().playing, true);
  assert.equal(media().muted, true);
  assert.equal(media().immersive, true);
  await act(async () => { media().onVideoPress(); });
  assert.equal(media().enabled, true, "pause must retain the authorized media");
  assert.equal(media().playing, false);
  await act(async () => { button("Unmute Reel").props.onPress(); });
  assert.equal(media().muted, false);
  await act(async () => { button("View player profile").props.onPress(); });
  await act(async () => { button("Create video post for HoopReels").props.onPress(); });
  await act(async () => { button("Check this Reel").props.onPress(); });
  assert.deepEqual(received, ["player", "create", "check"]);
  await act(async () => { button("Reel options").props.onPress(); });
  assert.equal(media().playing, false, "opening moderation controls pauses playback");
  await act(async () => { button("Report Reel").props.onPress(); });
  assert.deepEqual(received, ["player", "create", "check", "report"]);
  await act(async () => { tree.update(React.createElement(Card, { ...props, active: false, ready: true })); });
  assert.equal(media().enabled, true, "the next virtualized clip can be loaded ahead of time");
  assert.equal(media().playing, false, "offscreen videos cannot autoplay");
  assert.equal(media().muted, true, "swiping offscreen resets sound to silent");
  await act(async () => { tree.unmount(); });
});

test("HoopReels retains existing authenticated feed data and moderation security instead of creating a public feed", () => {
  const feed = read("../app/feed.tsx");
  const media = read("../components/FeedMedia.tsx");
  const video = read("../components/FeedVideo.tsx");
  const gate = read("../src/native/feedClient.ts");
  assert.match(feed, /account\?\.features\.canReadHoopFeed/);
  assert.match(feed, /blockedCreators\.owner === uid && blockedCreators\.ready && !blockedCreators\.failed/);
  assert.match(feed, /onEndReachedThreshold=\{reels \? 0\.6 : undefined\}/);
  assert.match(feed, /onReport=\{\(\) => void action/);
  assert.match(feed, /onBlockCreator=\{\(\) => void blockAccount/);
  assert.match(media, /authorizedFeedMedia\(/);
  assert.match(media, /enabled=\{enabled && playing\}/);
  assert.match(media, /onVideoPress \? <Pressable/);
  assert.match(video, /nativeControls=\{controls\}/);
  assert.match(gate, /eq\("status", "approved"\)/);
  assert.match(gate, /if \(reels\) query = query\.not\("video_url", "is", null\)/);
});
