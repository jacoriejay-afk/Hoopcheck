const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const extensions={"video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"} as const;
export type StoryVideoInput={id:string;content_type:keyof typeof extensions;size:number;duration_ms:number};
export function validateStoryVideoInput(value:unknown):StoryVideoInput{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid video.");
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["id","content_type","size","duration_ms"].includes(k))||typeof v.id!=="string"||!uuid.test(v.id)||typeof v.content_type!=="string"||!Object.hasOwn(extensions,v.content_type)||typeof v.size!=="number"||!Number.isSafeInteger(v.size)||v.size<1||v.size>50*1024*1024||typeof v.duration_ms!=="number"||!Number.isSafeInteger(v.duration_ms)||v.duration_ms<1||v.duration_ms>60000)throw Error("Choose a video up to 60 seconds and 50 MB.");
 return {id:v.id,content_type:v.content_type as StoryVideoInput["content_type"],size:v.size,duration_ms:v.duration_ms};
}
export function storyVideoPath(owner:string,input:StoryVideoInput){
 if(!uuid.test(owner))throw Error("Invalid account.");
 const v=validateStoryVideoInput(input);
 return "story-quarantine/"+owner+"/"+v.id+"."+extensions[v.content_type];
}
export function storyVideoMetadataMatches(metadata:unknown,input:StoryVideoInput){
 if(!metadata||typeof metadata!=="object")return false;
 const m=metadata as Record<string,unknown>;
 return m.size===input.size&&m.mimetype===input.content_type;
}
