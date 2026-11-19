import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readWithDeadline } from '../src/native/readDeadline.ts';
function native(overrides={}) {
 const calls=[];let fileSize=500,permission={granted:true};
 const image={uri:'file:///private/image.jpg',width:4000,height:3000};
 const stubs={
  'react-native':{Platform:{OS:'ios'}},
  'expo-image-picker':{VideoExportPreset:{MediumQuality:2},launchImageLibraryAsync:async options=>{calls.push(['picker',options]);return {canceled:false,assets:[image]};},requestMediaLibraryPermissionsAsync:async()=>permission},
  'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},ImageManipulator:{manipulate:()=>({rotate:value=>calls.push(['rotate',value]),crop:value=>calls.push(['crop',value]),resize:value=>calls.push(['resize',value]),release:()=>calls.push(['release-context']),renderAsync:async()=>({saveAsync:async options=>{calls.push(['save',options]);return {...image,width:720,height:720};},release:()=>calls.push(['release-image'])})})}},
  'expo-file-system':{File:class{get size(){return fileSize;}get exists(){return true;}}},
  'expo-file-system/legacy':{FileSystemUploadType:{BINARY_CONTENT:0},FileSystemSessionType:{FOREGROUND:1}},
  './readDeadline':{readWithDeadline},...overrides,
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/native/mediaSelection.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};
 new Function('require','exports',code)(id=>{assert.ok(id in stubs,id);return stubs[id];},exports);
 return {api:exports,calls,image,setSize:value=>fileSize=value,setPermission:value=>permission=value};
}

test('avatar preparation crops centrally, resizes to 720 and emits JPEG without EXIF/base64',async()=>{
 const f=native();const result=await f.api.choosePhoto(true);
 assert.deepEqual(f.calls.find(c=>c[0]==='crop')[1],{originX:500,originY:0,width:3000,height:3000});assert.deepEqual(f.calls.find(c=>c[0]==='resize')[1],{width:720});
 const options=f.calls.find(c=>c[0]==='picker')[1];assert.deepEqual(options.mediaTypes,['images']);assert.equal(options.exif,false);assert.equal(options.base64,false);assert.equal(result.type,'image/jpeg');assert.equal(result.size,500);
 assert.ok(f.calls.some(c=>c[0]==='release-context'));assert.ok(f.calls.some(c=>c[0]==='release-image'));
});
test('oversized or remote images fail before decoding and rotations resize the resulting orientation',async()=>{
 const f=native();await assert.rejects(f.api.preparePhoto({...f.image,uri:'https://evil.test/image.jpg'}));await assert.rejects(f.api.preparePhoto({...f.image,width:10000,height:10000}));assert.equal(f.calls.length,0);
 await f.api.preparePhoto(f.image,false,true);assert.deepEqual(f.calls.find(c=>c[0]==='rotate'),['rotate',90]);assert.deepEqual(f.calls.find(c=>c[0]==='resize')[1],{height:1440});
});
test('failed compression is bounded and releases native references',async()=>{
 const f=native();f.setSize(800000);await assert.rejects(f.api.preparePhoto(f.image),/smaller/);assert.equal(f.calls.filter(c=>c[0]==='save').length,3);assert.ok(f.calls.some(c=>c[0]==='release-image'));assert.ok(f.calls.some(c=>c[0]==='release-context'));
});
test('library denial never opens a video picker; limited access and cancellation are supported',async()=>{
 let picked=0;
 const picker={VideoExportPreset:{MediumQuality:2},requestMediaLibraryPermissionsAsync:async()=>({granted:false,accessPrivileges:'none'}),launchImageLibraryAsync:async()=>{picked++;return {canceled:true,assets:null};}};
 const denied=native({'expo-image-picker':picker});await assert.rejects(denied.api.chooseVideo(),denied.api.MediaPermissionError);assert.equal(picked,0);
 picker.requestMediaLibraryPermissionsAsync=async()=>({granted:false,accessPrivileges:'limited'});assert.equal(await denied.api.chooseVideo(),null);assert.equal(picked,1);
});
test('photo upload uses an existing local URI descriptor and refuses changed files',async()=>{
 const f=native();const photo={...f.image,type:'image/jpeg',name:'photo.jpg',size:500};assert.deepEqual(await f.api.photoBody(photo),{uri:photo.uri,name:photo.name,type:photo.type});f.setSize(600);await assert.rejects(f.api.photoBody(photo),/choose it again/);
});
test('native video upload is file-backed binary, foreground-only, abortable and does not read base64/bytes',async()=>{
 const controller=new AbortController();let resolve,cancelled=0,options;
 const f=native({'expo-file-system/legacy':{FileSystemUploadType:{BINARY_CONTENT:0},FileSystemSessionType:{FOREGROUND:1},createUploadTask:(url,uri,opts)=>{assert.equal(url,'https://storage.test/upload');assert.equal(uri,'file:///private/video.mov');options=opts;return {uploadAsync:()=>new Promise(yes=>resolve=yes),cancelAsync:async()=>{cancelled++;resolve(undefined);}};}}});
 const uploading=f.api.uploadVideoFile('https://storage.test/upload',{'Content-Type':'video/quicktime'},{uri:'file:///private/video.mov',size:500},controller.signal);
 controller.abort();await assert.rejects(uploading,/cancelled/);assert.equal(cancelled,1);assert.equal(options.uploadType,0);assert.equal(options.sessionType,1);assert.equal(options.httpMethod,'PUT');
});
