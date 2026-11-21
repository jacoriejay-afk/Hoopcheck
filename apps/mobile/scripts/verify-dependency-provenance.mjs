import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const vendor = join(root, 'vendor');
const manifest = JSON.parse(readFileSync(join(vendor, 'provenance.json')));
const sha = data => createHash('sha256').update(data).digest('hex');
for (const [file, digest] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(join(vendor, file))), digest, file);
for (const [name, consumer] of [['decode-uri-component', 'query-string'], ['image-size', 'metro']]) {
  const consumerRequire = createRequire(require.resolve(consumer));
  const installed = dirname(consumerRequire.resolve(`${name}/package.json`));
  assert.equal(resolve(installed), resolve(root, 'node_modules', name), `${name} must be packed`);
  for (const [file, digest] of Object.entries(manifest.files)) if (file.startsWith(`${name}/`)) assert.equal(sha(readFileSync(join(installed, file.slice(name.length + 1)))), digest, `installed ${file}`);
}
if (process.argv.includes('--upstream')) {
  const temporary = mkdtempSync(join(tmpdir(), 'hoopcheck-provenance-'));
  try {
    for (const [name, { version, sha256 }] of Object.entries(manifest.upstream)) {
      execFileSync('npm', ['pack', `${name}@${version}`, '--ignore-scripts', '--registry=https://registry.npmjs.org', '--pack-destination', temporary], { stdio: 'pipe', timeout: 120000 });
      const tarball = join(temporary, `${name}-${version}.tgz`);
      assert.equal(sha(readFileSync(tarball)), sha256, `${name} tarball`);
      const upstreamFile = file => execFileSync('tar', ['-xOf', tarball, `package/${file}`]);
      if (name === 'decode-uri-component') {
        assert.equal(readFileSync(join(vendor, name, 'index.js'), 'utf8'), upstreamFile('index.js').toString().replace('export default function decodeUriComponent', 'module.exports = function decodeUriComponent'));
        assert.deepEqual(readFileSync(join(vendor, name, 'license')), upstreamFile('license'));
      } else for (const file of Object.keys(manifest.files).filter(f => f.startsWith(`${name}/dist/`) || f === `${name}/LICENSE`)) assert.deepEqual(readFileSync(join(vendor, file)), upstreamFile(file.slice(name.length + 1)), file);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
console.log('PASS vendored hashes, installed copies, consumer resolution and requested upstream provenance');
