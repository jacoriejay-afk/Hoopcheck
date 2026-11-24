import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import React from "react";
import {act,create} from "react-test-renderer";
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url), exports={};
const source=readFileSync(new URL("../components/DirectoryIdentity.tsx",import.meta.url),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const stubs={
  "react-native":{Image:"Image",View:"View"},
  "react-native-svg":{__esModule:true,default:"Svg",Path:"Path",Text:"SvgText"},
  "../src/primitives":{Chip:"Chip"},
  "../src/theme":{useEntryTheme:()=>({crest:{panel:"#111",border:"#444",ink:"#fff"},button:"#ff873c",roles:{women:"#aaa",leagues:"#bbb"},type:{fontFamily:"System"}})},
  "../src/crest":{crestColor:()=>"#222",crestInitials:name=>name.slice(0,2)},
  "../src/countryFlag":{countryFlag:()=>""},
};
new Function("require","exports",code)(id=>stubs[id]??require(id),exports);
test("directory crest renders an honest fallback immediately, times out, and retries on URL changes",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  let tree;
  const props={name:"League",kind:"leagues",logoUrl:"https://media.test/a.png"};
  await act(async()=>{tree=create(React.createElement(exports.DirectoryCrest,props));});
  try{
    assert.equal(tree.root.findAllByType("Svg").length,1);
    assert.equal(tree.root.findByType("Image").props.style.opacity,0);
    assert.equal(tree.root.findAllByProps({accessibilityLabel:"League initials badge"}).length,1);
    await act(async()=>t.mock.timers.tick(8000));
    assert.equal(tree.root.findAllByType("Image").length,0);
    assert.equal(tree.root.findAllByType("Svg").length,1);
    await act(async()=>tree.update(React.createElement(exports.DirectoryCrest,{...props,logoUrl:"https://media.test/b.png"})));
    await act(async()=>tree.root.findByType("Image").props.onLoad());
    assert.equal(tree.root.findAllByType("Svg").length,0);
    assert.equal(tree.root.findByType("Image").props.style.opacity,1);
    assert.equal(tree.root.findAllByProps({accessibilityLabel:"League logo"}).length,1);
    await act(async()=>t.mock.timers.tick(8000));
    assert.equal(tree.root.findAllByType("Image").length,1);
    await act(async()=>tree.update(React.createElement(exports.DirectoryCrest,{...props,name:"Another league",logoUrl:"https://media.test/b.png"})));
    assert.equal(tree.root.findByType("Image").props.style.opacity,0);
    assert.equal(tree.root.findAllByType("Svg").length,1);
    await act(async()=>tree.root.findByType("Image").props.onError());
    assert.equal(tree.root.findAllByType("Image").length,0);
  }finally{await act(async()=>tree.unmount());}
});
test("unsafe artwork URLs never mount a network image",async()=>{
  for(const logoUrl of ["http://media.test/logo.png","https://user:password@media.test/logo.png","invalid",null]){
    let tree;
    await act(async()=>{tree=create(React.createElement(exports.DirectoryCrest,{name:"Club",logoUrl}));});
    try{assert.equal(tree.root.findAllByType("Image").length,0);assert.equal(tree.root.findAllByType("Svg").length,1);}
    finally{await act(async()=>tree.unmount());}
  }
});
