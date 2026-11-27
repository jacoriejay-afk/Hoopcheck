import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const src=readFileSync(new URL("../src/native/cameraCapture.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/HoopCheckCamera.tsx",import.meta.url),"utf8");
const composer=readFileSync(new URL("../components/MediaPostComposer.tsx",import.meta.url),"utf8");
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url),"utf8"));
const config=JSON.parse(readFileSync(new URL("../app.json",import.meta.url),"utf8"));
function native(size=3000){
 const deleted=[],api={};
 const stub={Paths:{cache:{uri:"file:///private/cache/"}},File:class{constructor(uri){this.uri=uri;this.size=size;this.exists=true;}delete(){deleted.push(this.uri);}}};
 const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function("require","exports",code)(name=>{assert.equal(name,"expo-file-system");return stub;},api);
 return {api,deleted};
}
test("SDK54 native camera dependency and lockfile agree, with existing purpose strings",()=>{
 assert.equal(pkg.dependencies["expo-camera"],"17.0.10");assert.equal(lock.packages[""].dependencies["expo-camera"],"17.0.10");
 assert.equal(lock.packages["node_modules/expo-camera"].version,"17.0.10");
 const plugin=config.expo.plugins.find(p=>Array.isArray(p)&&p[0]==="expo-camera");
 assert.equal(plugin[1].cameraPermission,"Allow HoopCheck to take basketball photos and record videos when you choose to capture media.");
 assert.equal(plugin[1].microphonePermission,"Allow HoopCheck to record audio with videos you choose to capture.");
});
test("camera only accepts app-cache native video with allowed format and bounded bytes",()=>{
 const {api,deleted}=native();
 assert.equal(api.prepareCameraVideo("file:///private/cache/clip.mov").type,"video/quicktime");
 assert.equal(api.prepareCameraVideo("file:///private/cache/clip.mp4").type,"video/mp4");
 for(const uri of ["https://example.com/clip.mp4","file:///private/photos/clip.mp4","file:///private/cache-other/clip.mp4","file:///private/cache/../clip.mp4","file:///private/cache/clip.webm","file:///private/cache/clip.mp4?x=1"])assert.throws(()=>api.prepareCameraVideo(uri));
 assert.throws(()=>native(51*1024*1024).api.prepareCameraVideo("file:///private/cache/clip.mp4"));
 api.discardCameraFile("file:///private/photos/original.jpg");api.discardCameraFile("file:///private/cache/clip.mp4");
 assert.deepEqual(deleted,["file:///private/cache/clip.mp4"]);
});
test("dedicated preview is opt-in, explicit capture and separate moderated composer",()=>{
 assert.match(src,/EXPO_PUBLIC_HOOPCHECK_NATIVE_CAMERA_ENABLED === "true"/);
 assert.match(composer,/cameraOpen && enabled && nativeCameraEnabled && Platform.OS !== "web"/);
 assert.match(ui,/<CameraView/);assert.match(ui,/onCameraReady/);
 assert.match(ui,/onPressOut=\{\(\)=>\{if\(held.current\)stop\(\);\}\}/);
 assert.match(ui,/videoQuality="1080p"/);assert.match(ui,/codec:"avc1"/);
 assert.match(ui,/maxDuration:CAMERA_MAX_SECONDS,maxFileSize:CAMERA_MAX_BYTES/);
 assert.match(ui,/base64:false,skipProcessing:false/);
 assert.match(ui,/state==="background"/);assert.match(ui,/useFocusEffect/);
 assert.doesNotMatch(ui,/publishMediaPost|supabase|fetch\(/);
 assert.match(composer,/Review your capture and add a caption before posting/);
});
