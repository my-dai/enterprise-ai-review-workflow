import type { LessonRecord, PdfReviewComment, Role } from './workflow-data';
export type CommentState = 'open' | 'author-ready' | 'resolved';
export interface CommentResolution {
  state: CommentState; actor: string; at: string; version: string;
}
// Content version excludes display names and workflow state. Editing content reopens a resolved concern.
export function reviewContentVersion(lesson: Partial<LessonRecord>): string {
  return JSON.stringify(['title','project','topic','discipline','company','customer','csiDivision','deliverySystem','situation','rootCause','impact','recommendation','keywords'].map((field) => [field, lesson[field as keyof LessonRecord] ?? '']));
}
export function effectiveCommentState(comment: PdfReviewComment, lesson: Partial<LessonRecord>): CommentState {
  const entry = comment.resolution;
  return entry && ['open', 'author-ready', 'resolved'].includes(entry.state) && entry.version === reviewContentVersion(lesson) ? entry.state : 'open';
}
export function canSetCommentState(lesson: LessonRecord, role: Role, actor: string, current: CommentState, next: CommentState) {
  if (!actor) return false;
  const author = role === 'Contributor' && lesson.submittedBy === actor && lesson.status === 'Changes requested';
  const expectedStatus = role === 'Reviewer 1' ? 'Reviewer 1 review' : role === 'SME' ? 'SME review' : 'Final review';
  const assigned = role === 'Reviewer 1' ? lesson.level1Manager : role === 'SME' ? lesson.sme : lesson.qualityManager;
  const reviewer = role !== 'Contributor' && lesson.status === expectedStatus && actor === assigned;
  return next === 'author-ready' ? author && current === 'open' :
    next === 'resolved' ? reviewer && current === 'author-ready' :
    next === 'open' ? reviewer || (author && current === 'author-ready') : false;
}
export function resubmissionRoute(lesson: Partial<LessonRecord>) {
  const role = lesson.status === 'Changes requested' ? lesson.returnTo ?? 'Reviewer 1' : 'Reviewer 1';
  const email = (role === 'SME' ? lesson.sme : role === 'Final reviewer' ? lesson.qualityManager : lesson.level1Manager) ?? '';
  return { role, email, restarts: role === 'Reviewer 1' };
}
export function commentField(comment: PdfReviewComment): string | undefined {
  if (comment.field) return comment.field;
  // Legacy metadata annotations have no field key. Recover only an exact, unambiguous snapshot match.
  const metadataFields: Record<string, string> = { Customer: 'customer', Company: 'company', Topic: 'topic', Discipline: 'discipline', Project: 'project', Author: 'author' };
  try {
    const snapshot = JSON.parse(comment.documentKey) as { metadata?: [string,string][] };
    const matches = (snapshot.metadata ?? []).filter(([label, value]) =>
      metadataFields[label] && (comment.quote.trim() === label + ': ' + value || comment.quote.trim() === value));
    return matches.length === 1 ? metadataFields[matches[0][0]] : undefined;
  } catch { return undefined; }
}
