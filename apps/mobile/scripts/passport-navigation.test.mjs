import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url);
test('navigating away closes the real Passport sheet and invalidates an in-flight export',async()=>{
 let blur,resolveExport,io;const haptics=[];
 const pending=new Promise(resolve=>{resolveExport=resolve;});
 const owner='11111111-1111-4111-8111-111111111111';
 const theme={spacing:{xs:4,sm:8,md:12,lg:16,xl:24},radius:{hero:20},type:{caption:{},title:{},body:{}},entityHero:{}};
 const exports={};const stubs={
  'expo-router':{useFocusEffect:callback=>React.useEffect(()=>{blur=callback();return blur;},[callback])},
  'react-native':{Platform:{OS:'ios'},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Text:'Text',View:'View'},
  './BrandLogo':{BrandLogo:'BrandLogo'},'./Sheet':{Sheet:({open,children})=>open?React.createElement('Sheet',null,children):null},
  '../src/primitives':{Button:'Button'},'../src/theme':{useEntryTheme:()=>theme},'../src/native/haptics':{useHaptics:()=>value=>haptics.push(value)},
  '../src/lib/supabase':{supabase:{}},'../src/native/useNativeAccount':{useNativeAccount:()=>({account:{user:{id:owner,accountType:'player'}}})},
  '../src/native/playerPassport':{passportFields:()=>({name:'Owner',position:null,team:null,years:null,verified:false})},
  '../src/native/accountClient':{requestNativeAccount:()=>{}},'../src/native/readDeadline':{readWithDeadline:()=>{}},
  '../src/native/passportSharing':{sharePlayerPassport:async(_pass,_owner,dependencies)=>{io=dependencies;await pending;}},
 };
 const source=readFileSync(new URL('../components/PlayerPassport.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>stubs[id]||require(id)});
 let tree;await act(async()=>{tree=create(React.createElement(exports.PlayerPassport,{player:{id:owner}}));});
 const click=async label=>{const button=tree.root.findAllByType('Button').find(node=>node.props.children===label);assert.ok(button);await act(async()=>button.props.onPress());};
 await click('Preview Player Passport');await click('Export & share PDF');
 assert.equal(io.current(),true);assert.equal(tree.root.findAllByType('Sheet').length,1);
 await act(async()=>blur());assert.equal(io.current(),false);assert.equal(tree.root.findAllByType('Sheet').length,0);
 await act(async()=>resolveExport());assert.deepEqual(haptics,[]);
 await act(async()=>tree.unmount());
});
