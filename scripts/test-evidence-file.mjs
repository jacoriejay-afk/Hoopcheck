import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectEvidenceFile, MAX_EVIDENCE_BYTES } from '../lib/security/evidence-file.ts';
const signatures = [
  ['application/pdf', 'pdf', [37,80,68,70,45]],
  ['image/jpeg', 'jpg', [255,216,255]],
  ['image/png', 'png', [137,80,78,71,13,10,26,10]],
  ['image/webp', 'webp', [82,73,70,70,0,0,0,0,87,69,66,80]],
];
for (const [mime, extension, signature] of signatures) {
  test(`recognizes ${mime} with correct and absent declared MIME`, async () => {
    const bytes = new Uint8Array(16); bytes.set(signature);
    for (const type of [mime, '', 'application/octet-stream']) assert.deepEqual(await inspectEvidenceFile(new Blob([bytes], {type})), {mime,extension});
    assert.equal(await inspectEvidenceFile(new Blob([bytes], {type:'text/html'})), null);
  });
}
test('rejects an HTML payload falsely labeled PDF', async () => {
  assert.equal(await inspectEvidenceFile(new Blob(['<html>invalid</html>'], {type:'application/pdf'})), null);
});
test('rejects SVG falsely labeled PNG', async () => {
  assert.equal(await inspectEvidenceFile(new Blob(['<svg onload=""></svg>'], {type:'image/png'})), null);
});
test('rejects empty, truncated and oversized input', async () => {
  assert.equal(await inspectEvidenceFile(new Blob([])), null);
  assert.equal(await inspectEvidenceFile(new Blob(['%PDF-'])), null);
  assert.equal(await inspectEvidenceFile(new Blob(['%PDF-1.7',new Uint8Array(MAX_EVIDENCE_BYTES)])), null);
});
