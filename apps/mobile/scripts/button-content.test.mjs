import assert from 'node:assert/strict';import{test}from'node:test';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import vm from'node:vm';import ts from'typescript';import React from'react';import{act,create}from'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const require=createRequire(import.meta.url),exports={};
const code=ts.transpileModule(readFileSync(new URL('../src/primitives.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const Pressable=({children,...props})=>React.createElement('Pressable',props,typeof children==='function'?children({pressed:false}):children);
const stubs={'expo-blur':{BlurView:'BlurView'},'react-native':{Platform:{OS:'ios'},Pressable,Text:'Text',View:'View',TextInput:'TextInput'},'./theme':{useEntryTheme:()=>({foreground:'#111',onButton:'#fff',button:'#f90',spacing:{md:12},radius:{control:12}})}};
vm.runInNewContext(code,{exports,require:id=>Object.hasOwn(stubs,id)?stubs[id]:require(id)});
async function render(children){let tree;await act(async()=>{tree=create(React.createElement(exports.Button,null,children));});return tree;}
test('the actual shared button wraps interpolated string/number labels in native Text',async()=>{
 for(const children of ['Save',['Rotate photo ',2],['Pro',' · ',6,' months']]){const tree=await render(children);const host=tree.root.findByType('Pressable');assert.equal(host.findAllByType('Text').length,1);assert.ok(host.children.every(child=>typeof child!=='string'),'raw text cannot be directly under Pressable');assert.equal(host.props.accessibilityRole,'button');await act(async()=>tree.unmount());}
});
test('mixed icon/text and render-function button labels retain native-safe text wrappers',async()=>{
 for(const children of [[React.createElement('Icon',{key:'icon'}),'Share'],()=>['Restore ',1,' purchase']]){const tree=await render(children);const host=tree.root.findByType('Pressable');assert.ok(host.children.every(child=>typeof child!=='string'));assert.equal(host.findAllByType('Text').length,1);await act(async()=>tree.unmount());}
});
test('shared buttons expose disabled state to assistive technology in either theme',async()=>{
 let tree;await act(async()=>{tree=create(React.createElement(exports.Button,{disabled:true},'Save'));});
 assert.equal(tree.root.findByType('Pressable').props.accessibilityState.disabled,true);
 await act(async()=>tree.unmount());
});
