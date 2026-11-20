const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const r = createRequire(process.cwd()+'/package.json');
(async()=>{
const sharp=r('sharp');
for(const format of ['png','jpeg']) { const b=await sharp({create:{width:80,height:40,channels:3,background:'#ff790b'}})[format]().toBuffer(); const m=await sharp(b).metadata(); assert.equal(m.width,80); assert.equal(m.height,40); }
const g=r('glob'); const pattern='app/**/*.{ts,tsx}'; const opts={cwd:process.cwd(),nodir:true};
assert.deepEqual((await g.glob(pattern,opts)).sort(),g.globSync(pattern,opts).sort()); assert(g.globSync(pattern,opts).length>20);
const p=r('@expo/fingerprint/build/utils/Path.js'); assert(p.isIgnoredPath('node_modules/a/index.js',['**/node_modules/**'])); assert(!p.isIgnoredPath('app/index.tsx',['**/node_modules/**'])); assert(p.isIgnoredPath('.hidden/file',['**']));
console.log('PASS sharp PNG/JPEG roundtrip, async/sync glob and real fingerprint ignore consumer');
})().catch(e=>{console.error(e);process.exitCode=1});
