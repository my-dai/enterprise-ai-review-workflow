// Readable excerpts from the existing SharePoint list, not extracted PDF text.
export interface LibraryEvidence {
  id: number;
  title: string;
  pdf: { name: string; link: string };
  situation?: string;
  rootCause?: string;
  impact?: string;
  recommendation?: string;
  keywords?: string;
  discipline?: string;
}
const stop = new Set('the a an of to and in on for with from this that was were is are be by it as at or we our they their lesson learned project'.split(' '));
const tokens = (text: string) => [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter((word) => !stop.has(word));
export const evidenceFields = ['title', 'keywords', 'situation', 'rootCause', 'impact', 'recommendation'] as const;
export function rankLibraryEvidence(query: string, rows: LibraryEvidence[], limit = 5) {
  const terms = tokens(query);
  if (!terms.length) return [];
  return rows.map((item) => {
    const matches = evidenceFields.flatMap((field) => {
      const text = item[field] ?? '';
      const words = new Set(tokens(text));
      const matched = terms.filter((term) => words.has(term));
      return matched.length ? [{ field, text, matched }] : [];
    });
    const score = matches.reduce((total, match) => total + match.matched.length * (match.field === 'title' ? 3 : match.field === 'keywords' ? 2 : 1), 0);
    return { item, matches, score };
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score || b.item.id - a.item.id).slice(0, limit);
}
export function evidenceExcerpt(text: string, matched: string[] = [], max = 420) {
  const positions = matched.map((term) => text.toLowerCase().indexOf(term)).filter((n) => n >= 0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 70) : 0;
  return (start ? '…' : '') + text.slice(start, start + max) + (text.length > start + max ? '…' : '');
}
export function sourceContext(rows: LibraryEvidence[]) {
  return rows.slice(0, 3).map((item) => ({
    id: item.id, title: item.title,
    situation: (item.situation ?? '').slice(0, 1800),
    rootCause: (item.rootCause ?? '').slice(0, 1200),
    impact: (item.impact ?? '').slice(0, 1000),
    recommendation: (item.recommendation ?? '').slice(0, 1800),
  }));
}
