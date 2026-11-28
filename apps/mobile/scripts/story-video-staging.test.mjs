import {test} from "node:test";
import assert from "node:assert/strict";
import {validateStoryVideoInput,storyVideoPath,storyVideoMetadataMatches} from "../src/native/storyVideoStaging.ts";
const input={id:"33333333-3333-4333-8333-333333333333",content_type:"video/mp4",size:42,duration_ms:60000};
const owner="11111111-1111-4111-8111-111111111111";
test("private staging path is separated from publishable feed media",()=>{
 assert.equal(storyVideoPath(owner,input),"story-quarantine/"+owner+"/"+input.id+".mp4");
 for(const bad of [{...input,size:0},{...input,size:52428801},{...input,duration_ms:60001},{...input,content_type:"text/html"},{...input,id:"../bad"},{...input,approved:true}])assert.throws(()=>validateStoryVideoInput(bad));
 assert.throws(()=>storyVideoPath("../bad",input));
 assert.equal(storyVideoMetadataMatches({size:42,mimetype:"video/mp4"},input),true);
 assert.equal(storyVideoMetadataMatches({size:41,mimetype:"video/mp4"},input),false);
 assert.equal(storyVideoMetadataMatches({size:42,mimetype:"video/quicktime"},input),false);
});
