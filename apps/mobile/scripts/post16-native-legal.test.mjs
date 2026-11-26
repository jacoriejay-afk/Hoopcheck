import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("native policy snapshots match the full canonical policy text, headings and bullets",()=>{
  const snapshot=read("../src/native/legalDocuments.ts");
  const json=snapshot.match(/export const legalDocuments = ([\s\S]+) as const;/);
  assert.ok(json);
  const docs=JSON.parse(json[1]);
  for(const kind of ["privacy","terms"]){
    const page=read("../../../app/"+kind+"/page.tsx");
    const intro=page.match(/<section className="hero">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1];
    const body=page.split('<div className="legal-card">')[1]?.split('<div className="legal-footer">')[0];
    assert.ok(intro&&body);
    const blocks=[...body.matchAll(/<(h2|p|li)(?: className="updated")?>([\s\S]*?)<\/\1>/g)].map(m=>({kind:m[1],text:m[2].trim()}));
    assert.equal(docs[kind].intro,intro);
    assert.deepEqual(docs[kind].blocks,blocks);
  }
});
test("Settings and native support open native legal screen",()=>{
  assert.match(read("../app/settings.tsx"),/pathname:"\/account\/policies"/);
  const support=read("../app/account/support.tsx");
  assert.match(support,/pathname:"\/account\/policies",params:\{kind:"privacy"\}/);
  assert.match(support,/pathname:"\/account\/policies",params:\{kind:"terms"\}/);
});

test("account deletion does not promise subscription cancellation or completed deletion",()=>{
  const terms=read("../../../app/terms/page.tsx");
  assert.match(terms,/Deleting your HoopCheck account does not automatically cancel subscriptions/);
  assert.match(terms,/Cancellation is not a condition for submitting an account deletion request/);
  assert.match(terms,/apps\.apple\.com\/account\/subscriptions\//);
  assert.match(terms,/a request alone does not mean deletion has completed/);
  assert.doesNotMatch(terms,/Active HoopCheck subscriptions are canceled as part of the deletion process/);
});
