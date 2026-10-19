import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFieldRevision } from '../src/lib/field-revision.ts';
import { rankLibraryEvidence, sourceContext } from '../src/lib/library-evidence.ts';
import { canSetCommentState, commentField, effectiveCommentState, resubmissionRoute, reviewContentVersion } from '../src/lib/review-followup.ts';
const source = { id: 71, title: 'A site experience', rootCause: 'Cable tray conflicts caused rework.', pdf: { name: 'source', link: 'https://example.test/source' } };
const revision = { field: 'rootCause', replacement: '', explanation: 'More facts needed.', questions: ['Why was the review omitted?'], sourceIds: [] };
test('missing facts may return questions without replacing any author text', () => {
  assert.equal(parseFieldRevision(JSON.stringify(revision), 'rootCause', []).replacement, '');
});
test('prose, wrong fields, malformed questions and invented citations are rejected', () => {
  assert.throws(() => parseFieldRevision('You should improve this.', 'rootCause', []));
  for (const override of [{ field: 'impact' }, { questions: 'not an array' }, { sourceIds: [999] }, { sourceIds: ['71'] }, { replacement: 'x'.repeat(12001) }]) {
    assert.throws(() => parseFieldRevision(JSON.stringify({ ...revision, ...override }), 'rootCause', [source]));
  }
});
test('valid citations are restricted to supplied sources', () => {
  const result = parseFieldRevision(JSON.stringify({ ...revision, sourceIds: [71,71] }), 'rootCause', [source]);
  assert.deepEqual(result.sourceIds, [71]);
});
test('library search can discover content absent from the title and provides matched passages', () => {
  const results = rankLibraryEvidence('cable conflicts', [source, { ...source, id: 72, rootCause: 'A late concrete delivery' }]);
  assert.deepEqual(results.map((result) => result.item.id), [71]);
  assert.equal(results[0].matches[0].field, 'rootCause');
  assert.equal(rankLibraryEvidence('the lesson project', [source]).length, 0);
});
test('reference context is bounded and does not send source URLs or private metadata', () => {
  const result = sourceContext(Array.from({length:5}, (_, i) => ({ ...source, id: i, situation: 'x'.repeat(5000), owner: 'private' })));
  assert.equal(result.length, 3);
  assert.equal(result[0].situation.length, 1800);
  assert.equal('owner' in result[0], false);
  assert.equal('pdf' in result[0], false);
});
const lesson = { status: 'Changes requested', submittedBy: 'author', level1Manager: 'manager', sme: 'expert', qualityManager: 'final', returnTo: 'SME', title: 'A lesson', customer: 'A', rootCause: 'A cause' };
test('resubmission uses the actual return stage and assigned person', () => {
  assert.deepEqual(resubmissionRoute(lesson), { role: 'SME', email: 'expert', restarts: false });
  assert.equal(resubmissionRoute({ ...lesson, returnTo: 'Final reviewer' }).email, 'final');
  assert.equal(resubmissionRoute({ ...lesson, status: 'Draft' }).email, 'manager');
});
test('author readiness and reviewer resolution are distinct actions', () => {
  assert(canSetCommentState(lesson, 'Contributor', 'author', 'open', 'author-ready'));
  assert(!canSetCommentState(lesson, 'Contributor', 'author', 'author-ready', 'resolved'));
  assert(!canSetCommentState(lesson, 'Contributor', 'other', 'open', 'author-ready'));
  const review = { ...lesson, status: 'SME review' };
  assert(canSetCommentState(review, 'SME', 'expert', 'author-ready', 'resolved'));
  assert(!canSetCommentState(review, 'SME', 'other', 'author-ready', 'resolved'));
  assert(!canSetCommentState(review, 'SME', 'expert', 'open', 'resolved'));
});
test('confirmed feedback reopens after content edits but not routing changes', () => {
  const comment = { resolution: { state: 'resolved', version: reviewContentVersion(lesson) } };
  assert.equal(effectiveCommentState(comment, { ...lesson, status: 'Approved' }), 'resolved');
  assert.equal(effectiveCommentState(comment, { ...lesson, customer: 'B' }), 'open');
});
test('legacy customer quote resolves deterministically; vague or ambiguous quotes do not', () => {
  const documentKey = JSON.stringify({ metadata: [['Customer','Acme'],['Company','Acme']] });
  assert.equal(commentField({ quote: 'Customer: Acme', documentKey }), 'customer');
  assert.equal(commentField({ quote: 'Acme', documentKey }), undefined);
  assert.equal(commentField({ quote: 'Check the customer', documentKey }), undefined);
});
