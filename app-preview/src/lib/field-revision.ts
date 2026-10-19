import type { LibraryEvidence } from './library-evidence';
// Form revision integration.
export type RevisionField = 'situation' | 'rootCause' | 'impact' | 'recommendation';
export interface FieldRevision {
  field: RevisionField;
  replacement: string;
  explanation: string;
  questions: string[];
  sourceIds: number[];
}
// A prose reply must never be mistaken for replacement form content.
export function parseFieldRevision(reply: string, field: RevisionField, sources: LibraryEvidence[]): FieldRevision {
  const text = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('The agent returned feedback instead of a structured revision. Your text has not changed.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The revision response is incomplete.');
  const row = data as Record<string, unknown>;
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length <= 2000);
  if (row.field !== field || typeof row.replacement !== 'string' || row.replacement.length > 12000 ||
      typeof row.explanation !== 'string' || row.explanation.length > 4000 || !strings(row.questions) || row.questions.length > 8 ||
      !Array.isArray(row.sourceIds) || !row.sourceIds.every((id) => Number.isInteger(id) && sources.some((source) => source.id === id))) {
    throw new Error('The revision response has invalid fields or references. Your text has not changed.');
  }
  return { field, replacement: row.replacement.trim(), explanation: row.explanation, questions: row.questions, sourceIds: [...new Set(row.sourceIds as number[])] };
}
