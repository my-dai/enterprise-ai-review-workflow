import type { PdfHighlightRect } from './workflow-data';

/** Measure selected text nodes rather than parent spans, then merge adjacent glyph fragments. */
export function selectedPdfRects(range: Range, layer: HTMLElement, page: HTMLElement): PdfHighlightRect[] {
  const bounds = page.getBoundingClientRect();
  const fragments: { left: number; top: number; right: number; bottom: number }[] = [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim() || !range.intersectsNode(node)) continue;
    const part = document.createRange();
    part.selectNodeContents(node);
    if (range.startContainer === node) part.setStart(node, range.startOffset);
    if (range.endContainer === node) part.setEnd(node, range.endOffset);
    for (const rect of part.getClientRects()) {
      const left = Math.max(bounds.left, rect.left), right = Math.min(bounds.right, rect.right);
      const top = Math.max(bounds.top, rect.top), bottom = Math.min(bounds.bottom, rect.bottom);
      if (right - left > 0.5 && bottom - top > 1) fragments.push({ left, top, right, bottom });
    }
  }
  fragments.sort((a, b) => Math.abs(a.top - b.top) < 2 ? a.left - b.left : a.top - b.top);
  const lines: typeof fragments = [];
  for (const fragment of fragments) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.top - fragment.top) < 2 && fragment.left <= previous.right + 2) {
      previous.right = Math.max(previous.right, fragment.right);
      previous.bottom = Math.max(previous.bottom, fragment.bottom);
    } else lines.push({ ...fragment });
  }
  return lines.map((rect) => ({ page: Number(page.dataset.page), x: (rect.left - bounds.left) / bounds.width,
    y: (rect.top - bounds.top) / bounds.height, width: (rect.right - rect.left) / bounds.width, height: (rect.bottom - rect.top) / bounds.height }));
}
