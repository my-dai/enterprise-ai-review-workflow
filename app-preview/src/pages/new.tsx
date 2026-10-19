import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Paperclip, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { FeedbackTextarea } from '@/components/feedback-textarea';
import { LessonCoach } from '@/components/lesson-coach';
import type { CoachFlowForm } from '@/lib/lesson-coach-api';
import { KeywordSuggestions } from '@/components/keyword-suggestions';
import { mergeKeywords } from '@/lib/ai-feedback-state';
import { LibraryReferences } from '@/components/library-references';
import type { LibraryEvidence } from '@/lib/library-evidence';
import { resubmissionRoute } from '@/lib/review-followup';
import { PdfLessonReview } from '@/components/pdf-lesson-review';
import { DeleteDraftButton } from '@/components/delete-draft-button';
import { LookupSelect } from '@/components/lookup-select';
import { PersonSelect } from '@/components/person-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LookupKey, PeopleKey } from '@/data/lookups';
import { useWorkflow, type LessonFields, type LessonRecord, type PdfEditableField } from '@/lib/workflow-data';

// Fields, labels, order, and required flags match the original Lesson Learned form; dropdowns read the LL_* SharePoint lists.
type TextKey = 'title' | 'keywords' | 'project';
type StringKey = { [K in keyof LessonFields]-?: LessonFields[K] extends string | undefined ? K : never }[keyof LessonFields];
type LookupField = { key: StringKey; label: string; lookup: LookupKey; required?: boolean };
type TextField = { key: TextKey; label: string; required?: boolean; placeholder?: string };
type PersonField = { key: 'author'; label: string; people: PeopleKey; required?: boolean };
const detailFields: (({ kind: 'lookup' } & LookupField) | ({ kind: 'text' } & TextField) | ({ kind: 'person' } & PersonField))[] = [
  { kind: 'lookup', key: 'topic', label: 'Topic', lookup: 'topic', required: true },
  { kind: 'lookup', key: 'customer', label: 'Customer', lookup: 'customer' },
  { kind: 'text', key: 'title', label: 'Title', required: true, placeholder: 'One line others will recognize in search' },
  { kind: 'lookup', key: 'discipline', label: 'Discipline', lookup: 'discipline', required: true },
  { kind: 'lookup', key: 'csiDivision', label: 'CSI Division', lookup: 'csiDivision' },
  { kind: 'lookup', key: 'company', label: 'Company', lookup: 'company', required: true },
  { kind: 'lookup', key: 'deliverySystem', label: 'Delivery System', lookup: 'deliverySystem' },
  { kind: 'person', key: 'author', label: 'Author', people: 'author', required: true },
  { kind: 'text', key: 'project', label: 'Job Number' },
];
const descriptionFields = [
  { key: 'situation', label: 'Description/Background', required: true },
  { key: 'rootCause', label: 'Root Cause', required: true },
  { key: 'impact', label: 'Impacts', required: true },
  { key: 'recommendation', label: 'Lessons Learned, Corrective Preventive Action or Improvement Practice', required: true },
] as const;
const fieldLabels: Partial<Record<StringKey, string>> = {
  ...Object.fromEntries([...detailFields, ...descriptionFields].map((field) => [field.key, field.label])),
  keywords: 'Keywords', level1Manager: 'Level 1 Manager',
};
const requiredKeys: StringKey[] = ['topic', 'title', 'discipline', 'company', 'keywords', 'author', 'situation', 'rootCause', 'impact', 'recommendation', 'level1Manager'];

const blank: LessonFields = {
  title: '', project: '', jobType: 'Other', category: 'Quality', discipline: '',
  situation: '', lesson: '', recommendation: '', impact: '', topic: '',
  rootCause: '', keywords: '', company: '', customer: '', costImpact: '', projectBased: false,
  csiDivision: '', deliverySystem: '', author: '', level1Manager: '', sme: '', qualityManager: '', attachments: [],
};
function FormSection({ id, number, title, subtitle, children }: { id: string; number: number; title: string; subtitle: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 rounded-xl border bg-white p-6 shadow-sm"><div className="mb-6 flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{number}</span><div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div></div><div className="space-y-5">{children}</div></section>;
}
export default function NewLessonPage() {
  const { lessons, loading } = useWorkflow();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  // Wait for SharePoint before opening a saved lesson, so the form starts from its saved values.
  if (editId && loading) return <Card><CardContent className="py-10 text-center text-muted-foreground">Loading lesson…</CardContent></Card>;
  return <LessonForm key={editId ?? 'new'} existing={lessons.find((item) => item.id === editId)} />;
}
function LessonForm({ existing }: { existing?: LessonRecord }) {
  const { addLesson, reviseLesson, actor, nameOf } = useWorkflow();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const submitter = actor;
  const [fields, setFields] = useState<LessonFields>(() => existing ? {
    title: existing.title, project: existing.project === 'Company-wide' ? '' : existing.project, jobType: existing.jobType, category: existing.category,
    discipline: existing.discipline, situation: existing.situation, lesson: existing.lesson,
    recommendation: existing.recommendation, impact: existing.impact, topic: existing.topic ?? '',
    rootCause: existing.rootCause ?? '', keywords: existing.keywords ?? '', company: existing.company ?? '',
    customer: existing.customer ?? '', costImpact: existing.costImpact ?? '', projectBased: existing.projectBased ?? false,
    csiDivision: existing.csiDivision ?? '', deliverySystem: existing.deliverySystem ?? '', author: existing.author ?? existing.submittedBy,
    level1Manager: existing.level1Manager ?? '', sme: existing.sme ?? '', qualityManager: existing.qualityManager ?? '',
    attachments: existing.attachments ?? [],
  } : { ...blank, author: submitter });
  const [revisionNote, setRevisionNote] = useState('');
  const [references, setReferences] = useState<LibraryEvidence[]>([]);
  const [pdfEditPending, setPdfEditPending] = useState(false);
  const pdfMode = existing?.status === 'Changes requested' && params.get('view') !== 'form';
  useEffect(() => {
    const field = params.get('field');
    if (pdfMode || !field || ![...detailFields, ...descriptionFields].some((item) => item.key === field)) return;
    const element = document.getElementById(field);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  }, [pdfMode, params]);
  const setField = <K extends keyof LessonFields>(key: K, value: LessonFields[K]) => setFields((current) => ({ ...current, [key]: value }));
  const pdfEditing = { onChange: (key: PdfEditableField, value: string) => setField(key, value), onPendingChange: setPdfEditPending };
  const text = (key: StringKey) => String(fields[key] ?? '');
  const destination = resubmissionRoute({ ...existing, ...fields });
  // stay: keep the author on this page after saving (Save draft, Save PDF changes).
  // After a blocked submit, missing required fields are outlined until they're filled in.
  const [showMissing, setShowMissing] = useState(false);
  const missing = requiredKeys.filter((key) => !text(key).trim());
  const required = (key: StringKey, node: React.ReactNode) => {
    const invalid = showMissing && missing.includes(key);
    return <div key={key} data-field={key} className={invalid ? 'field-missing' : undefined}>{node}{invalid && <p className="mt-1 text-xs font-medium text-red-700">Required</p>}</div>;
  };
  const save = async (submit: boolean, stay = false) => {
    if (pdfEditPending) { toast.error('Apply or cancel your PDF text edit before saving.'); return; }
    if (submit && missing.length) {
      setShowMissing(true);
      toast.error(`Complete the required fields: ${missing.map((key) => fieldLabels[key] ?? key).join(', ')}.`);
      const first = document.querySelector<HTMLElement>(`[data-field="${missing[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.querySelector<HTMLElement>('input, textarea, [role="combobox"]')?.focus({ preventScroll: true });
      return;
    }
    const next = { ...fields, projectBased: Boolean(fields.project.trim()), lesson: fields.lesson || fields.recommendation };
    setSaving(true);
    const createdId = existing ? null : await addLesson(next, submit ? 'Reviewer 1 review' : 'Draft');
    const saved = existing ? await reviseLesson(existing.id, next, submit, revisionNote) : Boolean(createdId);
    setSaving(false);
    if (!saved) return;
    toast.success(submit ? 'Lesson submitted for review.' : pdfMode ? 'PDF changes saved.' : 'Draft saved.');
    if (!stay) navigate('/');
    // A new lesson now exists in SharePoint; keep editing that one so later saves don't create duplicates.
    else if (createdId) navigate(`/new?edit=${createdId}`, { replace: true });
  };
  // The form's text as named fields, sent to the coach and keyword agents.
  const flowForm: CoachFlowForm = {
    topic: text('topic'), customer: text('customer'), title: text('title'), discipline: text('discipline'), csiDivision: text('csiDivision'),
    company: text('company'), keywords: text('keywords'), deliverySystem: text('deliverySystem'), author: nameOf(text('author')), project: text('project'),
    situation: text('situation'), rootCause: text('rootCause'), impact: text('impact'), recommendation: text('recommendation'),
    level1Manager: nameOf(text('level1Manager')), revisionNote, attachments: fields.attachments ?? [],
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => file.size <= 25 * 1024 * 1024 && (['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)));
    if (accepted.length !== files.length) toast.error('Use PDF, JPG, or PNG files up to 25 MB each.');
    setField('attachments', [...(fields.attachments ?? []), ...accepted]);
  };
  if (existing && (existing.submittedBy !== submitter || !['Draft', 'Changes requested'].includes(existing.status))) return <Card><CardContent className="py-10 text-center">This lesson is not editable in this role. <Link to={`/lessons/${existing.id}`} className="underline">View its progress</Link>.</CardContent></Card>;
  return <div className={`space-y-7 ${pdfMode ? '' : 'mx-auto w-full max-w-5xl'}`}>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"><div><Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Home</Link><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{existing ? 'Edit lesson' : 'New Lessons Learned'}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Draft</span></div></div><div className="flex gap-2">{existing?.status === 'Draft' && <DeleteDraftButton lessonId={existing.id} title={existing.title} size="default" onDeleted={() => navigate('/')} />}<Button variant="outline" disabled={saving || pdfEditPending} onClick={() => void save(false, true)}>Save draft</Button><Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" disabled={saving || pdfEditPending} onClick={() => void save(true)}>{existing?.status === 'Changes requested' ? 'Resubmit for approval' : 'Submit for approval'}<ArrowRight className="size-4" /></Button></div></div>
    {existing?.status === 'Changes requested' && <div className="rounded-lg border-l-4 border-amber-700 bg-amber-50 p-4"><p className="font-semibold">Changes requested by {existing.returnTo}</p><p className="mt-1 text-sm">{[...existing.history].reverse().find((entry) => entry.action === 'Requested changes')?.comment}</p><p className="mt-3 text-sm font-medium">Resubmit to: {destination.email ? nameOf(destination.email) : 'Reviewer not assigned'} · {destination.role}</p><p className="mt-1 text-xs text-muted-foreground">{destination.restarts ? 'Review resumes at Level 1 Manager.' : 'Returns directly to this reviewer. Earlier approval stages are not repeated.'}</p></div>}
    {existing?.status === 'Changes requested' && <div className="flex flex-wrap items-center gap-3"><Button variant={pdfMode ? 'default' : 'outline'} disabled={pdfEditPending} onClick={() => { const next = new URLSearchParams(params); next.set('view', 'pdf'); setParams(next); }}>Edit PDF{existing.pdfComments?.length ? ` · ${existing.pdfComments.length} comment${existing.pdfComments.length === 1 ? '' : 's'}` : ''}</Button><Button variant={!pdfMode ? 'default' : 'outline'} disabled={pdfEditPending} onClick={() => { const next = new URLSearchParams(params); next.set('view', 'form'); setParams(next); }}>Lesson fields</Button><p className="text-xs text-muted-foreground">Both views edit the same lesson. Apply text edits, then save or resubmit.</p></div>}
    {pdfMode && existing ? <PdfLessonReview key={existing.id} lesson={{ ...existing, ...fields }} canAnnotate={false} canReply editing={pdfEditing} renderSidebar={(pdfComments, pending) => <div className="space-y-4"><Card><CardContent className="pt-5">{pdfComments}</CardContent></Card><Card><CardContent className="space-y-3 pt-5"><Label htmlFor="pdf-revision-note">What did you change? (optional)</Label><Textarea id="pdf-revision-note" value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Summarize your revisions for the SME" /><Button className="w-full" variant="outline" disabled={saving || pending} onClick={() => void save(false, true)}>Save PDF changes</Button><Button className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300" disabled={saving || pending} onClick={() => void save(true)}>Resubmit for approval</Button>{pending && <p className="text-xs text-amber-800">Apply or cancel the open text edit before saving.</p>}<p className="text-xs text-muted-foreground">Use Lesson fields for classification, approvers and attachments.</p></CardContent></Card></div>} /> : <>
    <div>
      <div className="space-y-5">
        <FormSection id="details" number={1} title="Lesson details" subtitle="Classify the lesson so others can find it and it reaches the right reviewers.">
          <div className="grid gap-4 sm:grid-cols-2">{detailFields.map((field) => required(field.key, field.kind === 'lookup'
            ? <LookupSelect key={field.key} id={field.key} label={field.label} required={field.required} lookup={field.lookup} value={text(field.key)} onChange={(value) => setField(field.key, value)} />
            : field.kind === 'person'
            ? <PersonSelect key={field.key} id={field.key} label={field.label} required={field.required} people={field.people} value={text(field.key)} extraPeople={[{ email: submitter, name: nameOf(submitter) }]} onChange={(value) => setField(field.key, value)} />
            : <div key={field.key}><Label htmlFor={field.key}>{field.label}{field.required ? ' *' : ''}</Label><Input id={field.key} className="mt-2" value={text(field.key)} onChange={(event) => setField(field.key, event.target.value)} placeholder={field.placeholder} /></div>))}</div>
        </FormSection>
        <FormSection id="descriptions" number={2} title="Descriptions" subtitle="Tell the story: what happened, why, the impact, and what to do next time.">
          <LibraryReferences initialQuery={[fields.title, fields.keywords].filter(Boolean).join(' ')} selected={references} onSelect={setReferences} />
          {descriptionFields.map(({ key, label, required: isRequired }) => required(key, <FeedbackTextarea key={key} field={key} label={label} required={isRequired} value={text(key)} onChange={(value) => setField(key, value)} placeholder={key === 'recommendation' ? 'What should the next team do differently?' : undefined} form={flowForm} sources={references} />))}
        </FormSection>
        <FormSection id="keywords" number={3} title="Keywords" subtitle="Help others find this lesson in search. Type your own, generate suggestions from what you wrote, or both.">
          {required('keywords', <div>
            <Label htmlFor="keywords">Keywords *</Label>
            <Input id="keywords" className="mt-2" value={text('keywords')} onChange={(event) => setField('keywords', event.target.value)} placeholder="e.g. pre-pour, embeds, quality" />
            <div className="mt-3"><KeywordSuggestions form={flowForm} onAccept={(suggestions) => setFields((current) => ({ ...current, keywords: mergeKeywords(current.keywords ?? '', suggestions) }))} /></div>
          </div>)}
        </FormSection>
        <FormSection id="approval" number={4} title="Approval" subtitle="Choose your Level 1 Manager. They choose the SME when they approve, and the SME chooses the Quality Manager.">
          <div className="grid gap-4 sm:grid-cols-2">{required('level1Manager', <><PersonSelect id="level1Manager" label="Level 1 Name Submitter Manager" required people="level1Manager" value={text('level1Manager')} onChange={(value) => setField('level1Manager', value)} /><p className="mt-1 text-xs text-muted-foreground">Submitter: {nameOf(fields.author || submitter)}</p></>)}</div>
        </FormSection>
        <FormSection id="attachments" number={5} title="Attachments" subtitle="Photos, RFIs, bulletins, and marked-up drawings."><label htmlFor="files" className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-7 text-center hover:bg-slate-50"><UploadCloud className="size-6 text-muted-foreground" /><span className="mt-2 text-sm font-semibold">Browse files</span><span className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG up to 25 MB each · stored for this session</span></label><input id="files" className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event.target.files)} />{Boolean(fields.attachments?.length) && <div className="flex flex-wrap gap-2">{fields.attachments?.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs"><Paperclip className="size-3" />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setField('attachments', fields.attachments?.filter((_, i) => i !== index))}>×</button></span>)}</div>}</FormSection>
        {existing?.status === 'Changes requested' && <Card><CardContent className="pt-6"><Label htmlFor="revision-note">What did you change? (optional)</Label><Textarea id="revision-note" className="mt-2" value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Summarize the update for reviewers" /></CardContent></Card>}
        <div className="flex justify-end gap-2 pb-8">{existing?.status === 'Draft' && <DeleteDraftButton lessonId={existing.id} title={existing.title} size="default" onDeleted={() => navigate('/')} />}<Button variant="outline" disabled={saving || pdfEditPending} onClick={() => void save(false, true)}>Save draft</Button><Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" disabled={saving || pdfEditPending} onClick={() => void save(true)}>Submit for approval<ArrowRight className="size-4" /></Button></div>
      </div>
    </div>
    </>}
    {!pdfMode && <LessonCoach lesson={Object.fromEntries([...detailFields, ...descriptionFields, { key: 'keywords' as const, label: 'Keywords' }].map((field) => [field.label, field.key === 'author' ? nameOf(text(field.key)) : text(field.key)]))} form={flowForm} />}
  </div>;
}
