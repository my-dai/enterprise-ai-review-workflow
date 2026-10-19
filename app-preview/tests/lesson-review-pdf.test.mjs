// Run with Node 22.18+ (native TypeScript stripping): node --test tests/lesson-review-pdf.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createLessonReviewPdf, projectPdfComments, quoteHighlightRects, reviewDocumentKey } from '../src/lib/lesson-review-pdf.ts';

const lesson = {
  id: 'LL-1047', title: 'Record cable tray conflicts before closeout', project: 'Orion Plant Expansion',
  category: 'Quality', discipline: 'Electrical', submittedBy: 'Sam Cho', status: 'SME review',
  situation: 'A cable tray conflict was found after ceiling closure.',
  impact: 'Avoids ceiling rework and inspection delays.',
  recommendation: 'Add a cable tray clearance check to the pre-closeout walk.',
};
const comment = {
  id: 'comment-1', documentKey: reviewDocumentKey(lesson), quote: 'clearance check',
  rects: [{ page: 1, x: 0.3, y: 0.5, width: 0.2, height: 0.02 }],
  text: 'Specify the clearance and the owner.', actor: 'Dana Whitfield', role: 'SME', at: '2026-10-07T21:00:00Z',
  replies: [{ id: 'reply-1', actor: 'Sam Cho', text: 'The electrical lead will own this check.', at: '2026-10-07T22:00:00Z' }],
};
async function readPdf(record, comments) {
  const task = getDocument({ data: new Uint8Array(createLessonReviewPdf(record, comments).output('arraybuffer')), standardFontDataUrl: new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url).pathname });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const view = await pdf.getPage(page);
      pages.push({ text: (await view.getTextContent()).items.map((item) => item.str ?? '').join(' '), annotations: await view.getAnnotations() });
    }
    return pages;
  } finally { await task.destroy(); }
}

test('document anchors survive workflow changes but detach after a content revision', () => {
  assert.equal(reviewDocumentKey(lesson), reviewDocumentKey({ ...lesson, status: 'Changes requested', pdfComments: [comment] }));
  assert.notEqual(reviewDocumentKey(lesson), reviewDocumentKey({ ...lesson, recommendation: 'Revised clearance check.' }));
  assert.notEqual(reviewDocumentKey(lesson), reviewDocumentKey({ ...lesson, project: 'Different project' }));
});

test('review PDF contains selectable lesson content and metadata', async () => {
  const pages = await readPdf(lesson);
  assert.equal(pages.length, 1);
  for (const value of [lesson.title, lesson.submittedBy, lesson.situation, lesson.impact, lesson.recommendation]) assert(pages[0].text.includes(value));
  assert.equal(pages[0].annotations.length, 0);
});

test('annotated export includes native PDF notes, selected quotes and replies', async () => {
  const pages = await readPdf(lesson, [comment]);
  assert.equal(pages.length, 2);
  const notes = pages[0].annotations.filter((annotation) => annotation.subtype === 'Text');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].contentsObj.str, comment.text);
  assert(pages[1].text.includes(comment.quote));
  assert(pages[1].text.includes(comment.replies[0].text));
});

test('revised document export retains earlier feedback without attaching it to new text', async () => {
  const pages = await readPdf({ ...lesson, recommendation: 'An updated action.' }, [comment]);
  assert.equal(pages[0].annotations.length, 0);
  assert(pages[1].text.includes('Earlier document version'));
  assert(pages[1].text.includes(comment.quote));
});

test('long lessons paginate without losing the end of a section', async () => {
  const recommendation = `${'Inspect all installed tray clearances before ceiling closure. '.repeat(150)}END OF RECOMMENDATION`;
  const pages = await readPdf({ ...lesson, recommendation });
  assert(pages.length > 1);
  assert(pages.at(-1).text.includes('END OF RECOMMENDATION'));
});

test('editable PDF regions follow paragraphs over multiple pages', () => {
  const regions = [];
  const pdf = createLessonReviewPdf({ ...lesson, recommendation: 'A long revised action. '.repeat(400) }, undefined, regions);
  assert(regions.some((region) => region.field === 'recommendation' && region.page > 1));
  for (const region of regions) {
    assert(region.page <= pdf.getNumberOfPages());
    assert(region.x >= 0 && region.y >= 0 && region.x + region.width <= 1 && region.y + region.height <= 1);
  }
});

test('comments remain linked to their edited section and retain the original SME quote', () => {
  const revised = { ...lesson, recommendation: 'The electrical lead must verify clearance before closing the ceiling.', pdfComments: [{ ...comment, field: 'recommendation' }] };
  const regions = [];
  createLessonReviewPdf(revised, undefined, regions);
  const [projected] = projectPdfComments(revised, regions);
  assert.equal(projected.documentKey, reviewDocumentKey(revised));
  assert.equal(projected.quote, 'clearance check');
  assert.equal(projected.text, comment.text);
  assert.equal(projected.anchorKind, 'section');
  const target = regions.filter((region) => region.field === 'recommendation');
  assert.equal(projected.rects[0].y, target[0].y);
  assert(Math.abs(projected.rects.at(-1).y + projected.rects.at(-1).height - target.at(-1).y - target.at(-1).height) < 1e-8);
  assert.equal(revised.pdfComments[0].documentKey, comment.documentKey);
});

test('a quote that survives edits keeps a tight text highlight rather than a full section', () => {
  const revised = { ...lesson, impact: 'An expanded impact explanation.', pdfComments: [{ ...comment, field: 'recommendation' }] };
  const regions = [];
  createLessonReviewPdf(revised, undefined, regions);
  const [projected] = projectPdfComments(revised, regions);
  assert.equal(projected.anchorKind, 'text');
  assert.equal(projected.rects.length, 1);
  const line = regions.find((region) => region.field === 'recommendation');
  assert(projected.rects[0].x > line.x);
  assert(projected.rects[0].width < line.width / 3);
});

test('a wrapped quotation highlights only its words on each line', () => {
  const regions = [
    { field: 'recommendation', label: 'Action', text: 'First line has clearance', fontSize: 12, page: 1, x: 0.07, y: 0.3, width: 0.85, height: 0.025 },
    { field: 'recommendation', label: 'Action', text: 'check before closeout.', fontSize: 12, page: 1, x: 0.07, y: 0.33, width: 0.85, height: 0.025 },
  ];
  const rects = quoteHighlightRects('clearance\ncheck', regions);
  assert.equal(rects.length, 2);
  assert(rects[0].x > regions[0].x);
  assert.equal(rects[1].x, regions[1].x);
  assert(rects.every((rect) => rect.width < 0.2));
});

test('ambiguous repeated quotations get no guessed text location', () => {
  const region = { field: 'recommendation', label: 'Action', text: 'clearance check then repeat the clearance check', fontSize: 12, page: 1, x: 0.07, y: 0.3, width: 0.85, height: 0.025 };
  assert.deepEqual(quoteHighlightRects('clearance check', [region]), []);
});
