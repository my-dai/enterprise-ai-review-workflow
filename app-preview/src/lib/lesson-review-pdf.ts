import { GState, jsPDF } from 'jspdf';
import type { LessonRecord, PdfReviewComment, PdfEditableField, PdfHighlightRect } from './workflow-data';

export interface PdfEditRegion extends PdfHighlightRect { field: PdfEditableField; label: string; text: string; fontSize: number }
const sectionFields: Record<string, PdfEditableField> = { 'What happened': 'situation', 'Root cause': 'rootCause', Impact: 'impact', 'Lesson learned / corrective action': 'recommendation', Keywords: 'keywords' };

// Only document content forms the anchor version. Workflow decisions do not move highlights.
export function reviewDocumentContent(lesson: LessonRecord) {
  return {
    id: lesson.id, title: lesson.title || 'Untitled draft',
    metadata: [
      ['Topic', lesson.topic || 'Improvement Practice'], ['Discipline', lesson.discipline],
      ['Project', lesson.project], ['Author', lesson.submittedBy], ['Company', lesson.company],
      ['Customer', lesson.customer], ['Category', lesson.category],
      [lesson.topic === 'Lean Savings' ? 'Savings amount' : 'Cost of poor quality', lesson.costImpact ? `$${Number(lesson.costImpact).toLocaleString('en-US')}` : undefined],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
    sections: [
      ['What happened', lesson.situation], ['Root cause', lesson.rootCause], ['Impact', lesson.impact],
      ['Lesson learned / corrective action', lesson.recommendation], ['Keywords', lesson.keywords],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  };
}

export const reviewDocumentKey = (lesson: LessonRecord) => JSON.stringify(reviewDocumentContent(lesson));

export function createLessonReviewPdf(lesson: LessonRecord, comments?: PdfReviewComment[], regions?: PdfEditRegion[]) {
  const content = reviewDocumentContent(lesson);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 44;
  let y = margin;
  const ensureSpace = (amount: number) => {
    if (y + amount > height - margin) { pdf.addPage(); y = margin; }
  };
  const write = (text: string, size: number, bold = false, spacing = 10, field?: PdfEditableField, label?: string) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(text, width - margin * 2);
    for (const line of lines) {
      ensureSpace(size * 1.5);
      if (field) regions?.push({ field, label: label ?? field, text: line, fontSize: size, page: pdf.getNumberOfPages(), x: margin / width, y: (y + size * 0.15) / height, width: (width - margin * 2) / width, height: (size * 1.5) / height });
      pdf.text(line, margin, y + size);
      y += size * 1.5;
    }
    y += spacing;
  };
  pdf.setTextColor(24, 34, 49);
  write('Lesson Learned', 19, true);
  write(content.title, 15, true, 18, 'title', 'Title');
  for (const [label, value] of content.metadata) write(`${label}: ${value}`, 10, false, 2, label === 'Project' ? 'project' : undefined, label);
  y += 20;
  content.sections.forEach(([label, value], index) => {
    ensureSpace(65);
    write(`${index + 1}. ${label}`, 14, true, 8);
    write(value, 12, false, 22, sectionFields[label], label);
  });
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`${content.id}  |  Review copy  |  ${page} / ${pageCount}`, margin, height - 22);
  }
  if (comments?.length) {
    const key = reviewDocumentKey(lesson);
    comments.forEach((comment, index) => {
      if (comment.documentKey !== key) return;
      for (const rect of comment.rects) {
        if (rect.page < 1 || rect.page > pageCount) continue;
        pdf.setPage(rect.page);
        pdf.saveGraphicsState();
        pdf.setGState(new GState({ opacity: 0.3 }));
        pdf.setFillColor(255, 196, 0);
        if (comment.anchorKind === 'section') {
          pdf.setFillColor(59, 130, 246);
          pdf.rect(rect.x * width - 5, rect.y * height, 2, rect.height * height, 'F');
        } else pdf.rect(rect.x * width, rect.y * height, rect.width * width, rect.height * height, 'F');
        pdf.restoreGraphicsState();
      }
      const first = comment.rects[0];
      if (first && first.page <= pageCount) {
        pdf.setPage(first.page);
        pdf.createAnnotation({ type: 'text', title: `${index + 1}. ${comment.actor}`, contents: comment.text,
          bounds: { x: width - 30, y: first.y * height, w: 16, h: 16 }, open: false });
      }
    });
    pdf.addPage(); y = margin; pdf.setTextColor(24, 34, 49);
    write('Review comments', 19, true, 20);
    comments.forEach((comment, index) => {
      ensureSpace(70);
      write(`${index + 1}. ${comment.actor} (${comment.role})`, 12, true, 5);
      write(new Date(comment.at).toLocaleString('en-US'), 9, false, 5);
      if (comment.documentKey !== key) write('Earlier document version - highlight is not shown on this copy.', 10);
      write(`Selected text: ${comment.quote}`, 10);
      write(comment.text, 11);
      comment.replies.forEach((reply) => write(`${reply.actor}: ${reply.text}`, 10));
      y += 12;
    });
  }
  return pdf;
}

// Keep original feedback intact while projecting its anchor onto a revised PDF.
// If the selected wording changed, link to its section and explicitly label it revised.
export function projectPdfComments(lesson: LessonRecord, regions: PdfEditRegion[]): PdfReviewComment[] {
  const key = reviewDocumentKey(lesson);
  return (lesson.pdfComments ?? []).map((comment) => {
    if (comment.documentKey === key) return comment;
    let field = comment.field;
    // Earlier comments predate field anchors. Recover only an unambiguous original section.
    if (!field) {
      try {
        const original = JSON.parse(comment.documentKey) as ReturnType<typeof reviewDocumentContent>;
        const matches = original.sections.filter(([, text]) => text.replace(/\s+/g, ' ').includes(comment.quote.replace(/\s+/g, ' ')));
        if (matches.length === 1) field = sectionFields[matches[0][0]];
      } catch { /* Unrecognized snapshots retain their original, detached anchor. */ }
    }
    if (!field) return comment;
    const target = regions.filter((region) => region.field === field);
    if (!target.length) return comment;
    const exact = quoteHighlightRects(comment.quote, target);
    return { ...comment, field, documentKey: key, anchorKind: exact.length ? 'text' : 'section', rects: exact.length ? exact : sectionHighlightRects(target) };
  });
}

function sectionHighlightRects(regions: PdfEditRegion[]): PdfHighlightRect[] {
  return [...new Set(regions.map((region) => region.page))].map((page) => {
    const lines = regions.filter((region) => region.page === page);
    const first = lines[0], last = lines.at(-1)!;
    return { page, x: first.x, y: first.y, width: first.width, height: last.y + last.height - first.y };
  });
}

// Find the quote across wrapped lines, retaining a map back to each glyph position.
// Ambiguous/deleted wording gets a section anchor instead of a misleading text highlight.
export function quoteHighlightRects(quote: string, regions: PdfEditRegion[]): PdfHighlightRect[] {
  const locations: { region: PdfEditRegion; offset: number }[] = [];
  let text = '';
  for (const region of regions) {
    for (const token of region.text.matchAll(/\S+/g)) {
      if (text) { text += ' '; locations.push({ region, offset: token.index! }); }
      text += token[0];
      for (let offset = 0; offset < token[0].length; offset++) locations.push({ region, offset: token.index! + offset });
    }
  }
  const needle = quote.replace(/\s+/g, ' ').trim();
  const start = needle ? text.indexOf(needle) : -1;
  if (start < 0 || text.indexOf(needle, start + 1) >= 0) return [];
  const end = start + needle.length;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
  const matched = locations.slice(start, end);
  return [...new Set(matched.map((location) => location.region))].map((region) => {
    const offsets = matched.filter((location) => location.region === region).map((location) => location.offset);
    const from = Math.min(...offsets), to = Math.max(...offsets) + 1;
    pdf.setFont('helvetica', region.field === 'title' ? 'bold' : 'normal'); pdf.setFontSize(region.fontSize);
    return { page: region.page, x: region.x + pdf.getTextWidth(region.text.slice(0, from)) / pageWidth,
      y: region.y, width: pdf.getTextWidth(region.text.slice(from, to)) / pageWidth, height: region.fontSize * 1.1 / pageHeight };
  }).filter((rect) => rect.width > 0);
}
