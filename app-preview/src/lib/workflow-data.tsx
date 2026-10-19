import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePeople } from '@/hooks/use-lookup';
import { createLesson, loadLessons, removeLesson, saveComments, saveLesson } from '@/lib/lesson-store';
import { canSetCommentState, effectiveCommentState, resubmissionRoute, reviewContentVersion, type CommentResolution, type CommentState } from './review-followup';

export type Role = 'Contributor' | 'Reviewer 1' | 'SME' | 'Final reviewer';
export type LessonStatus = 'Draft' | 'Reviewer 1 review' | 'SME review' | 'Final review' | 'Changes requested' | 'Approved' | 'Rejected';
export type ReviewAudience = 'Contributor and reviewers' | 'Reviewers only';
export type OptionGroup = 'Project' | 'Job type' | 'Category' | 'Discipline' | 'Status';
export interface AuditEvent { id: string; at: string; actor: string; action: string; comment?: string; audience?: ReviewAudience }
export interface PdfHighlightRect { page: number; x: number; y: number; width: number; height: number }
export type PdfEditableField = 'title' | 'project' | 'situation' | 'rootCause' | 'impact' | 'recommendation' | 'keywords';
export interface PdfReviewComment {
  id: string; documentKey: string; quote: string; rects: PdfHighlightRect[];
  text: string; actor: string; role: Role; at: string;
  replies: { id: string; text: string; actor: string; at: string }[];
  field?: PdfEditableField;
  anchorKind?: 'text' | 'section';
  resolution?: CommentResolution;
  resolutionHistory?: CommentResolution[];
}
export interface LessonRecord {
  id: string; title: string; project: string; jobType: string; category: string; discipline: string;
  situation: string; lesson: string; recommendation: string; impact: string; status: LessonStatus;
  submittedBy: string; submittedOn: string; returnTo?: Exclude<Role, 'Contributor'>; history: AuditEvent[];
  topic?: string; rootCause?: string; keywords?: string;
  company?: string; customer?: string; costImpact?: string; projectBased?: boolean;
  csiDivision?: string; deliverySystem?: string; author?: string;
  level1Manager?: string; sme?: string; qualityManager?: string;
  attachments?: File[];
  pdfComments?: PdfReviewComment[];
}
export type LessonFields = Pick<LessonRecord, 'title' | 'project' | 'jobType' | 'category' | 'discipline' | 'situation' | 'lesson' | 'recommendation' | 'impact' | 'topic' | 'rootCause' | 'keywords' | 'company' | 'customer' | 'costImpact' | 'projectBased' | 'csiDivision' | 'deliverySystem' | 'author' | 'level1Manager' | 'sme' | 'qualityManager' | 'attachments'>;
export interface OptionRecord { id: string; group: OptionGroup; label: string; active: boolean }

export const roles: Role[] = ['Contributor', 'Reviewer 1', 'SME', 'Final reviewer'];
// Nobody is picked until the role's people list loads; the header then picks the first person.
export const demoActors: Record<Role, string> = { Contributor: '', 'Reviewer 1': '', SME: '', 'Final reviewer': '' };
// The SharePoint list each role's people come from, and the lesson field that assigns a lesson to them.
export const roleLookup: Record<Role, 'author' | 'level1Manager' | 'sme' | 'qualityManager'> = {
  Contributor: 'author', 'Reviewer 1': 'level1Manager', SME: 'sme', 'Final reviewer': 'qualityManager',
};
// A reviewer sees only lessons assigned to them by email. Every stage has a named reviewer: the submitter picks the
// Level 1 Manager, who picks the SME, who picks the Quality Manager.
export function isAssignedTo(lesson: LessonRecord, role: Exclude<Role, 'Contributor'>, actor: string): boolean {
  const assigned = role === 'Reviewer 1' ? lesson.level1Manager : role === 'SME' ? lesson.sme : lesson.qualityManager;
  return Boolean(actor) && assigned === actor;
}
// When the lesson was first submitted for review (drafts fall back to the day they were created).
export const submittedDate = (lesson: LessonRecord) => {
  const submitted = lesson.history.find((event) => event.action.startsWith('Submitted'));
  return submitted ? new Date(submitted.at).toLocaleDateString() : lesson.submittedOn;
};
export const stages: LessonStatus[] = ['Draft', 'Reviewer 1 review', 'SME review', 'Final review', 'Approved'];
export const queueStatus: Record<Exclude<Role, 'Contributor'>, LessonStatus> = {
  'Reviewer 1': 'Reviewer 1 review', SME: 'SME review', 'Final reviewer': 'Final review',
};
const nextStatus: Record<Exclude<Role, 'Contributor'>, LessonStatus> = {
  'Reviewer 1': 'SME review', SME: 'Final review', 'Final reviewer': 'Approved',
};
const makeEvent = (actor: string, action: string, comment?: string, audience?: ReviewAudience): AuditEvent => ({
  id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, comment, audience,
});

const starterOptions: OptionRecord[] = [
  ['Project','Orion Plant Expansion'],['Project','Atlas Retrofit'],['Job type','Commissioning'],
  ['Job type','Installation'],['Job type','Inspection'],['Category','Safety'],['Category','Quality'],
  ['Category','Schedule'],['Discipline','Mechanical'],['Discipline','Construction'],['Discipline','Electrical'],
  ...stages.map((status): [string, string] => ['Status', status]),['Status','Changes requested'],['Status','Rejected'],
].map(([group,label], index) => ({ id: `OPT-${index + 1}`, group: group as OptionGroup, label, active: true }));

interface WorkflowContextValue {
  role: Role; setRole: (role: Role) => void; lessons: LessonRecord[]; options: OptionRecord[];
  // Lessons are loading from SharePoint for the first time.
  loading: boolean;
  // The person acting in the current role (picked in the header), by email.
  actor: string; setActor: (email: string) => void;
  // Display name for an email, from the role people lists; falls back to the email itself.
  nameOf: (email?: string) => string;
  // Each action saves to SharePoint and resolves to false (after a toast) if the save failed.
  deleteLesson: (id: string) => Promise<boolean>;
  // PDF review comments are saved as JSON in the lesson's Comments column.
  addPdfComment: (id: string, comment: Pick<PdfReviewComment, 'documentKey' | 'quote' | 'rects' | 'text' | 'field'>) => Promise<boolean>;
  deletePdfComment: (id: string, commentId: string) => Promise<boolean>;
  replyToPdfComment: (id: string, commentId: string, text: string) => Promise<boolean>;
  setPdfCommentState: (id: string, commentId: string, state: CommentState) => Promise<boolean>;
  addLesson: (fields: LessonFields, status: 'Draft' | 'Reviewer 1 review') => Promise<string | null>;
  addLessons: (items: LessonFields[], status: 'Draft' | 'Reviewer 1 review') => Promise<{ imported: number; error?: string }>;
  reviseLesson: (id: string, fields: LessonFields, submit: boolean, note?: string) => Promise<boolean>;
  // nextApprover: the SME (chosen by Reviewer 1) or Quality Manager (chosen by the SME) when advancing, by email.
  reviewLesson: (id: string, action: 'advance' | 'return' | 'reject', comment: string, audience: ReviewAudience, nextApprover?: string) => Promise<boolean>;
  addOption: (group: OptionGroup, label: string) => void; toggleOption: (id: string) => void;
}
const WorkflowContext = createContext<WorkflowContextValue | null>(null);
const fieldsOf = (lesson: LessonRecord): LessonFields => ({
  title: lesson.title, project: lesson.project, jobType: lesson.jobType, category: lesson.category, discipline: lesson.discipline,
  situation: lesson.situation, lesson: lesson.lesson, recommendation: lesson.recommendation, impact: lesson.impact, topic: lesson.topic,
  rootCause: lesson.rootCause, keywords: lesson.keywords, company: lesson.company, customer: lesson.customer, costImpact: lesson.costImpact,
  projectBased: lesson.projectBased, csiDivision: lesson.csiDivision, deliverySystem: lesson.deliverySystem, author: lesson.author,
  level1Manager: lesson.level1Manager, sme: lesson.sme, qualityManager: lesson.qualityManager, attachments: lesson.attachments,
});
// The demo role and acting person are remembered in this browser so a refresh keeps them.
const remembered = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const remember = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };
const lessonsKey = ['lessons'];
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => remembered<Role>('ll-role', 'Contributor'));
  const [actors, setActors] = useState<Record<Role, string>>(() => remembered('ll-actors', demoActors));
  const actor = actors[role];
  const [options, setOptions] = useState(starterOptions);
  // Attachments are not saved to SharePoint yet; they stay in this session only.
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: lessonsKey, queryFn: loadLessons, staleTime: 30_000, refetchOnWindowFocus: true });
  useEffect(() => {
    if (query.error) toast.error(`Could not load lessons from SharePoint: ${query.error.message}`, { id: 'lessons-load' });
  }, [query.error]);
  const lessons = useMemo(() => (query.data ?? []).map((item) => files[item.id] ? { ...item, attachments: files[item.id] } : item), [query.data, files]);
  const people = [usePeople('author'), usePeople('level1Manager'), usePeople('sme'), usePeople('qualityManager')];
  const directory = useMemo(() => new Map(people.flat().map((person) => [person.email, person.name])), people); // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo<WorkflowContextValue>(() => {
    const nameOf = (email?: string) => (email && directory.get(email.toLowerCase())) || email || '';
    // Runs a SharePoint save, then reloads lessons so every page sees the change.
    const run = async <T,>(what: string, task: () => Promise<T>): Promise<T | null> => {
      try { const result = await task(); await queryClient.invalidateQueries({ queryKey: lessonsKey }); return result; }
      catch (error) { console.error(`Could not ${what}`, error); toast.error(`Could not ${what}: ${error instanceof Error ? error.message : String(error)}`); return null; }
    };
    const find = (id: string) => lessons.find((item) => item.id === id);
    // Shows the new comments right away, then saves them. Builds on the latest cached list so quick
    // consecutive comments don't overwrite each other.
    const updateComments = async (id: string, change: (comments: PdfReviewComment[]) => PdfReviewComment[]) => {
      const latest = queryClient.getQueryData<LessonRecord[]>(lessonsKey)?.find((item) => item.id === id);
      if (!latest) return false;
      const next = change(latest.pdfComments ?? []);
      queryClient.setQueryData<LessonRecord[]>(lessonsKey, (current) => current?.map((item) => item.id === id ? { ...item, pdfComments: next } : item));
      const saved = await run('save the PDF comments', () => saveComments(id, next));
      if (saved === null) await queryClient.invalidateQueries({ queryKey: lessonsKey });
      return saved !== null;
    };
    const keepFiles = (id: string, fields: LessonFields) => setFiles((current) => ({ ...current, [id]: fields.attachments ?? [] }));
    return {
      role, lessons, options, actor, nameOf, loading: query.isPending,
      setRole: (next) => { setRoleState(next); remember('ll-role', next); },
      setActor: (email) => setActors((current) => { const next = { ...current, [role]: email }; remember('ll-actors', next); return next; }),
      addPdfComment: async (id, comment) => {
        const item = find(id);
        if (!item || role === 'Contributor' || item.status !== queueStatus[role] || !isAssignedTo(item, role, actor) || !comment.text.trim() || !comment.quote.trim() || !comment.rects.length) return false;
        return updateComments(id, (comments) => [...comments, { ...comment, text: comment.text.trim(), id: crypto.randomUUID(), actor, role, at: new Date().toISOString(), replies: [] }]);
      },
      deletePdfComment: async (id, commentId) => {
        const item = find(id);
        if (!item || role === 'Contributor' || item.status !== queueStatus[role] || !isAssignedTo(item, role, actor)) return false;
        return updateComments(id, (comments) => comments.filter((comment) => !(comment.id === commentId && comment.actor === actor && comment.role === role)));
      },
      replyToPdfComment: async (id, commentId, text) => {
        const item = find(id);
        if (!item || role !== 'Contributor' || item.submittedBy !== actor || item.status !== 'Changes requested' || !text.trim()) return false;
        return updateComments(id, (comments) => comments.map((comment) => comment.id === commentId ? { ...comment, replies: [...comment.replies, { id: crypto.randomUUID(), text: text.trim(), actor, at: new Date().toISOString() }] } : comment));
      },
      setPdfCommentState: async (id, commentId, state) => {
        const item = find(id);
        const comment = item?.pdfComments?.find((entry) => entry.id === commentId);
        if (!item || !comment || !actor) return false;
        const current = effectiveCommentState(comment, item);
        if (!canSetCommentState(item, role, actor, current, state)) return false;
        const resolution: CommentResolution = { state, actor, at: new Date().toISOString(), version: reviewContentVersion(item) };
        return updateComments(id, (comments) => comments.map((entry) => entry.id === commentId
          ? { ...entry, resolution, resolutionHistory: [...(entry.resolutionHistory ?? []), resolution] } : entry));
      },
      deleteLesson: async (id) => {
        const item = find(id);
        if (!item || item.submittedBy !== actor || item.status !== 'Draft') return false;
        return (await run('delete the draft', () => removeLesson(item))) !== null;
      },
      addLesson: async (fields, status) => {
        if (status !== 'Draft' && !fields.level1Manager) { toast.error('Choose a Level 1 Manager before submitting.'); return null; }
        const action = status === 'Draft' ? 'Saved a draft' : 'Submitted for Reviewer 1 review';
        const id = await run('save the lesson', () => createLesson(fields, { status, submittedBy: actor }, makeEvent(actor, action)));
        if (id) keepFiles(id, fields);
        return id;
      },
      addLessons: async (items, status) => {
        if (!actor) return { imported: 0, error: 'Choose a contributor before importing.' };
        // Same rule as the form: a submitted lesson must name its Level 1 Manager, or no reviewer would see it.
        if (status !== 'Draft' && items.some((fields) => !fields.level1Manager)) return { imported: 0, error: 'Every submitted lesson needs a Level 1 Manager.' };
        let imported = 0;
        let error: string | undefined;
        for (const fields of items) {
          try {
            const action = status === 'Draft' ? 'Saved a draft' : 'Submitted for Reviewer 1 review';
            await createLesson(fields, { status, submittedBy: actor }, makeEvent(actor, action));
            imported++;
          } catch (cause) {
            console.error('Could not import a lesson', cause);
            error = cause instanceof Error ? cause.message : String(cause);
            break;
          }
        }
        if (imported) await queryClient.invalidateQueries({ queryKey: lessonsKey });
        return { imported, error };
      },
      reviseLesson: async (id, fields, submit, note) => {
        const item = find(id);
        if (!item || item.submittedBy !== actor || !['Draft', 'Changes requested'].includes(item.status)) return false;
        if (submit && !fields.level1Manager) { toast.error('Choose a Level 1 Manager before submitting.'); return false; }
        if (submit && !resubmissionRoute({ ...item, ...fields }).email.trim()) { toast.error('Choose the receiving reviewer before resubmitting.'); return false; }
        const status = submit ? (item.status === 'Draft' ? 'Reviewer 1 review' : queueStatus[item.returnTo ?? 'Reviewer 1']) : item.status;
        const action = submit ? (item.status === 'Draft' ? 'Submitted for Reviewer 1 review' : `Revised and resubmitted to ${item.returnTo ?? 'Reviewer 1'}`) : 'Saved revisions';
        const trimmed = note?.trim();
        keepFiles(id, fields);
        return (await run('save the lesson', () => saveLesson(id, fields, { status, returnTo: submit ? undefined : item.returnTo, submittedBy: item.submittedBy }, makeEvent(actor, action, trimmed, trimmed ? 'Contributor and reviewers' : undefined)))) !== null;
      },
      reviewLesson: async (id, action, comment, audience, nextApprover) => {
        const item = find(id);
        if (role === 'Contributor' || !item || item.status !== queueStatus[role] || !isAssignedTo(item, role, actor)) return false;
        if (action !== 'advance' && !comment.trim()) return false;
        const status = action === 'advance' ? nextStatus[role] : action === 'return' ? 'Changes requested' : 'Rejected';
        const chosen = action === 'advance' && role !== 'Final reviewer' ? nextApprover?.trim().toLowerCase() : undefined;
        const label = action === 'return' ? 'Requested changes' : action === 'reject' ? 'Rejected lesson' : role === 'Final reviewer' ? 'Approved and published' : `Sent to ${role === 'Reviewer 1' ? 'SME' : 'final reviewer'}${chosen ? ` (${nameOf(chosen)})` : ''}`;
        const visibility = action === 'advance' ? audience : 'Contributor and reviewers';
        const routing = chosen ? (role === 'Reviewer 1' ? { sme: chosen } : { qualityManager: chosen }) : {};
        const fields = { ...fieldsOf(item), ...routing };
        return (await run('save the review', () => saveLesson(id, fields, { status, returnTo: action === 'return' ? role : undefined, submittedBy: item.submittedBy }, makeEvent(actor, label, comment.trim() || undefined, comment.trim() ? visibility : undefined)))) !== null;
      },
      addOption: (group, label) => setOptions((current) => [...current, { id: `OPT-${Date.now()}`, group, label, active: true }]),
      toggleOption: (id) => setOptions((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item)),
    };
  }, [role, actor, lessons, options, directory, query.isPending, queryClient]);
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}
export function useWorkflow() { const value = useContext(WorkflowContext); if (!value) throw new Error('useWorkflow must be used within WorkflowProvider'); return value; }
