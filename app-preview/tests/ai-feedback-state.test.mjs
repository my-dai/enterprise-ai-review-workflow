import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lessonTextVersion, parseKeywords, mergeKeywords, requireAgentContent } from '../src/lib/ai-feedback-state.ts';

const form = { title: 'Cable tray coordination', situation: 'Tray conflicts with ductwork.', rootCause: 'Coordination was incomplete.', impact: 'Rework.', recommendation: 'Review clearances before installation.' };
test('snapshot includes every field sent to feedback and keyword agents', () => {
  for (const key of Object.keys(form)) assert.notEqual(lessonTextVersion(form), lessonTextVersion({ ...form, [key]: form[key] + ' revised' }));
});
test('unrelated metadata does not invalidate AI text feedback', () => {
  assert.equal(lessonTextVersion(form), lessonTextVersion({ ...form, author: 'Different reviewer', keywords: 'Edited manually' }));
});
test('identical content has a stable snapshot', () => assert.equal(lessonTextVersion(form), lessonTextVersion({ ...form })));
test('keyword merging keeps the latest manual additions and removes case-insensitive duplicates', () => {
  assert.equal(mergeKeywords('Manual addition, BIM', 'bim, coordination'), 'Manual addition, BIM, coordination');
});
test('keyword parser accepts numbered lists and quoted keywords', () => {
  assert.deepEqual(parseKeywords('1. "BIM"\n2. coordination; BIM'), ['BIM', 'coordination']);
});
test('known unavailable/limit replies are errors rather than keywords', () => {
  for (const reply of ['This agent is currently unavailable. Please try again later.', 'Service unavailable', 'Error: ContentFiltered', 'Usage limit exceeded', 'Too many requests', '']) assert.throws(() => requireAgentContent(reply), /not return usable/);
});
test('normal feedback mentioning service issues is not blanket-rejected', () => {
  assert.equal(requireAgentContent('Explain how the service outage affected the schedule.'), 'Explain how the service outage affected the schedule.');
});
test('keyword candidates are not automatically committed', () => {
  const current = 'author wording';
  const suggestions = parseKeywords(requireAgentContent('coordination, quality'));
  assert.equal(current, 'author wording');
  assert.equal(mergeKeywords(current, suggestions.join(', ')), 'author wording, coordination, quality');
});
