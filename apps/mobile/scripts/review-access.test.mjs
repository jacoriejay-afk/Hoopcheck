import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readReviewAccess } from '../src/native/reviewAccess.ts';
const id = '12345678-1234-1234-1234-123456789abc';
const review = { id: 'review-1', title: 'Title', body: 'Member-only text', overall_rating: 4, created_at: '2026-11-18' };
test('review request retains exact target and uses bearer auth with no cache', async () => {
  let input;
  const result = await readReviewAccess('https://sandbox.example', 'test-token', id, undefined, async (...args) => { input = args; return Response.json({ canReadFull: true, canWrite: false, reviews: [{ ...review, author_id: 'private', email: 'private' }] }); });
  const url = new URL(input[0]);
  assert.equal(url.origin, 'https://sandbox.example');
  assert.equal(url.pathname, '/api/review-access');
  assert.equal(url.searchParams.get('entityType'), 'womens-team');
  assert.equal(url.searchParams.get('entityId'), id);
  assert.equal(input[1].headers.Authorization, 'Bearer test-token');
  assert.equal(input[1].cache, 'no-store');
  assert.equal(input[1].redirect, 'error');
  assert.deepEqual(result, { canReadFull: true, canWrite: false, reviews: [review] });
});
test('lack of full-read permission drops review content even if sent by the service', async () => {
  const result = await readReviewAccess('https://sandbox.example', 'test-token', id, undefined, async () => Response.json({ canReadFull: false, canWrite: false, reviews: [review] }));
  assert.deepEqual(result.reviews, []);
});
test('unverified, failed and malformed responses fail closed', async () => {
  for (const status of [401, 403, 500]) await assert.rejects(readReviewAccess('https://sandbox.example', 'test-token', id, undefined, async () => new Response('private error', { status })), /unavailable/);
  for (const payload of [null, {}, { canReadFull: 'true', canWrite: true }]) await assert.rejects(readReviewAccess('https://sandbox.example', 'test-token', id, undefined, async () => Response.json(payload)), /Invalid review response/);
});
test('invalid request cannot send a session token', async () => {
  let called = false;
  const request = async () => { called = true; throw new Error('Must not call'); };
  for (const origin of ['http://sandbox.example', 'https://user:pass@sandbox.example', 'https://sandbox.example/other', 'https://sandbox.example?token=secret']) await assert.rejects(readReviewAccess(origin, 'test-token', id, undefined, request));
  await assert.rejects(readReviewAccess('https://sandbox.example', '', id, undefined, request));
  await assert.rejects(readReviewAccess('https://sandbox.example', 'test-token', '../other', undefined, request));
  assert.equal(called, false);
});
test('malformed ratings and review bodies never reach the native view', async () => {
  const result = await readReviewAccess('https://sandbox.example', 'test-token', id, undefined, async () => Response.json({ canReadFull: true, canWrite: true, reviews: [review, { ...review, overall_rating: 999 }, { ...review, body: { private: true } }, null] }));
  assert.deepEqual(result.reviews, [review]);
});
