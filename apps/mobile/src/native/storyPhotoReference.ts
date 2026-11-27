/** Photo pilot accepts exactly one private owner-scoped JPEG object. */
export function resolveStoryPhoto(owner:string,reference:unknown,images:unknown):boolean{
 if(typeof reference!=="string"||!Array.isArray(images)||images.length!==1||images[0]!==reference)return false;
 const prefix="hoopfeed-private-images/"+owner+"/";
 return reference.startsWith(prefix)&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg$/i.test(reference.slice(prefix.length));
}
