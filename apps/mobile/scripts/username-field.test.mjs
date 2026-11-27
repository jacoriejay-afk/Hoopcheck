import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("overlapping checks share one normalized request and stale results cannot validate a different username", async () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL("../components/UsernameField.tsx", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const requests = [];
  const stubs = {
    "react-native": { StyleSheet: { create: value => value }, Text: "Text", TextInput: "TextInput", View: "View" },
    "../src/theme": { useEntryTheme: () => ({ radius: { control: 8 } }) },
    "../src/lib/supabase": {
      supabase: { rpc: (name, args) => new Promise(resolve => requests.push({ name, args, resolve })) },
    },
  };
  const exports = {};
  new Function("exports", "require", outputText)(exports, id => stubs[id] ?? require(id));
  const ref = React.createRef();
  const field = value => React.createElement(exports.default, { ref, value, onChange: () => {} });
  let tree;
  await act(async () => { tree = create(field(" Court_One ")); });
  try {
    let first, overlapping;
    await act(async () => { first = ref.current.validate(); overlapping = ref.current.validate(); });
    assert.equal(first, overlapping);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].name, "is_username_available");
    assert.deepEqual(requests[0].args, { candidate_username: "court_one" });

    await act(async () => tree.update(field("Court_Two")));
    let current;
    await act(async () => { current = ref.current.validate(); });
    await act(async () => {
      requests[1].resolve({ data: false });
      requests[0].resolve({ data: true });
    });
    assert.deepEqual(await first, { valid: false });
    assert.deepEqual(await current, { valid: false, message: "That username is taken." });
    assert.equal(tree.root.findAllByType("Text").at(-1).props.children, "That username is taken.");
  } finally {
    await act(async () => tree.unmount());
  }
});
