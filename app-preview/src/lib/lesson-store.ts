import type { IOperationResult } from '@microsoft/power-apps/data';
import { Lessons_Learned_HistoryService } from '@/generated/services/Lessons_Learned_HistoryService';
import { Lessons_Learned_In_ProgressService } from '@/generated/services/Lessons_Learned_In_ProgressService';
import type { Lessons_Learned_HistoryRead } from '@/generated/models/Lessons_Learned_HistoryModel';
import type { Lessons_Learned_In_ProgressRead, Lessons_Learned_In_ProgressWrite } from '@/generated/models/Lessons_Learned_In_ProgressModel';
import type { AuditEvent, LessonFields, LessonRecord, LessonStatus, PdfReviewComment, ReviewAudience, Role } from '@/lib/workflow-data';

// Lessons live in SharePoint: one Lessons_Learned_In_Progress row per lesson and one
// Lessons_Learned_History row per workflow event. People are stored by lowercase email.
const UNTITLED = '(Untitled draft)';
const statuses: LessonStatus[] = ['Draft', 'Reviewer 1 review', 'SME review', 'Final review', 'Changes requested', 'Approved', 'Rejected'];
const reviewerRoles: Exclude<Role, 'Contributor'>[] = ['Reviewer 1', 'SME', 'Final reviewer'];

export const lessonId = (rowId: number) => `LL-${String(rowId).padStart(4, '0')}`;
export const rowIdOf = (id: string) => String(Number(id.replace(/^LL-/, '')));
const email = (value?: string) => value?.trim().toLowerCase() ?? '';

function unwrap<T>(result: IOperationResult<T>, what: string): T {
  if (!result.success) throw result.error ?? new Error(`Could not ${what}.`);
  return result.data;
}

function toEvent(row: Lessons_Learned_HistoryRead): AuditEvent {
  return {
    id: String(row.ID), at: row.Event_Date ?? row.Created ?? new Date(0).toISOString(),
    actor: email(row.Performed_By), action: row.Event ?? '', comment: row.Comment || undefined,
    audience: (row.Visible_To as ReviewAudience) || undefined,
  };
}

// PDF review comments are stored as a JSON array in the lesson's Comments column (plain multi-line text).
function parseComments(json?: string): PdfReviewComment[] {
  if (!json?.trim()) return [];
  try { const value: unknown = JSON.parse(json); return Array.isArray(value) ? value as PdfReviewComment[] : []; }
  catch { console.error('Ignoring unreadable PDF comments JSON', json); return []; }
}

function toLesson(row: Lessons_Learned_In_ProgressRead, history: AuditEvent[]): LessonRecord {
  const status = statuses.find((item) => item === row.StatusLevel) ?? 'Draft';
  const returnTo = reviewerRoles.find((item) => item === row.ReturnTo);
  const owner = email(row.Owner) || email(row.AuthorNameText) || email(row.Author?.Email);
  return {
    id: lessonId(row.ID ?? 0), title: row.Title === UNTITLED ? '' : row.Title ?? '',
    project: row.Job_x0020_Number ?? '', jobType: 'Other', category: 'Quality',
    discipline: row.Discipline?.Value ?? '', topic: row.Topic?.Value ?? '', customer: row.Customer?.Value ?? '',
    company: row.Company?.Value ?? '', csiDivision: row.CSI_x0020_Division?.Value ?? '', deliverySystem: row.Delivery_x0020_System?.Value ?? '',
    keywords: row.Keyword ?? '', situation: row.Description_x002f_Background ?? '', rootCause: row.Root_x0020_Cause ?? '',
    impact: row.Impacts ?? '', recommendation: row.Lessons_x0020_Learned_x002c__x00 ?? '', lesson: row.Lessons_x0020_Learned_x002c__x00 ?? '',
    author: email(row.AuthorNameText) || owner, level1Manager: email(row.Level1NameText), sme: email(row.Level2NameText), qualityManager: email(row.Level3NameText),
    status, returnTo, submittedBy: owner,
    submittedOn: row.Created ? new Date(row.Created).toLocaleDateString() : '',
    history, pdfComments: parseComments(row.Comments),
  };
}

export async function loadLessons(): Promise<LessonRecord[]> {
  const [rows, events] = await Promise.all([
    Lessons_Learned_In_ProgressService.getAll().then((result) => unwrap(result, 'load lessons')),
    Lessons_Learned_HistoryService.getAll().then((result) => unwrap(result, 'load lesson history')),
  ]);
  const byLesson = new Map<number, AuditEvent[]>();
  for (const row of events ?? []) {
    if (row.LessonID == null) continue;
    byLesson.set(row.LessonID, [...(byLesson.get(row.LessonID) ?? []), toEvent(row)]);
  }
  for (const list of byLesson.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  return (rows ?? []).filter((row) => row.ID != null).map((row) => toLesson(row, byLesson.get(row.ID!) ?? [])).sort((a, b) => b.id.localeCompare(a.id));
}

export type LessonState = Pick<LessonRecord, 'status' | 'returnTo' | 'submittedBy'>;

// SharePoint choice columns are written as { Value }; an empty choice clears the column.
const choice = (value?: string) => (value ? { Value: value } : null);
function toRow(fields: LessonFields, state: LessonState): Lessons_Learned_In_ProgressWrite {
  const approver = state.status === 'Reviewer 1 review' ? fields.level1Manager : state.status === 'SME review' ? fields.sme : state.status === 'Final review' ? fields.qualityManager : '';
  const row = {
    Title: fields.title.trim() || UNTITLED,
    Topic: choice(fields.topic), Customer: choice(fields.customer), Discipline: choice(fields.discipline),
    CSI_x0020_Division: choice(fields.csiDivision), Company: choice(fields.company), Delivery_x0020_System: choice(fields.deliverySystem),
    Keyword: fields.keywords ?? '', Job_x0020_Number: fields.project,
    Description_x002f_Background: fields.situation, Root_x0020_Cause: fields.rootCause ?? '', Impacts: fields.impact,
    Lessons_x0020_Learned_x002c__x00: fields.recommendation,
    AuthorNameText: email(fields.author), Level1NameText: email(fields.level1Manager), Level2NameText: email(fields.sme), Level3NameText: email(fields.qualityManager),
    ApproverNameText: email(approver), Owner: email(state.submittedBy),
    StatusLevel: state.status, ReturnTo: state.returnTo ?? '',
  };
  return row as unknown as Lessons_Learned_In_ProgressWrite;
}

async function addEvent(rowId: number, event: Omit<AuditEvent, 'id'>) {
  unwrap(await Lessons_Learned_HistoryService.create({
    Title: `${lessonId(rowId)} · ${event.action}`.slice(0, 255), LessonID: rowId,
    Performed_By: email(event.actor), Event: event.action, Comment: event.comment ?? '', Visible_To: event.audience ?? '', Event_Date: event.at,
  }), 'save the lesson history');
}

export async function createLesson(fields: LessonFields, state: LessonState, event: Omit<AuditEvent, 'id'>): Promise<string> {
  const created = unwrap(await Lessons_Learned_In_ProgressService.create(toRow(fields, state)), 'save the lesson');
  const rowId = created.ID!;
  await addEvent(rowId, event);
  return lessonId(rowId);
}

export async function saveLesson(id: string, fields: LessonFields, state: LessonState, event?: Omit<AuditEvent, 'id'>) {
  unwrap(await Lessons_Learned_In_ProgressService.update(rowIdOf(id), toRow(fields, state)), 'save the lesson');
  if (event) await addEvent(Number(rowIdOf(id)), event);
}

export async function saveComments(id: string, comments: PdfReviewComment[]) {
  unwrap(await Lessons_Learned_In_ProgressService.update(rowIdOf(id), { Comments: JSON.stringify(comments) }), 'save the PDF comments');
}

export async function removeLesson(lesson: LessonRecord) {
  await Lessons_Learned_In_ProgressService.delete(rowIdOf(lesson.id));
  await Promise.all(lesson.history.map((event) => Lessons_Learned_HistoryService.delete(event.id)));
}
