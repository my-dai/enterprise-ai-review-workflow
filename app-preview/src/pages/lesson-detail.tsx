import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { LessonHistory } from '@/components/lesson-history';
import { PdfLessonReview } from '@/components/pdf-lesson-review';
import { PersonSelect } from '@/components/person-select';
import { ResubmissionNote } from '@/components/resubmission-note';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { isAssignedTo, queueStatus, useWorkflow, type ReviewAudience } from '@/lib/workflow-data';

const nextLabel = { 'Reviewer 1': 'SME', SME: 'final reviewer', 'Final reviewer': 'library', Contributor: 'Reviewer 1' };
export default function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, lessons, reviewLesson, actor, loading } = useWorkflow();
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState<'advance' | 'return' | 'reject'>('advance');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [nextApprover, setNextApprover] = useState<string | null>(null);
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson && loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading lesson…</CardContent></Card>;
  if (!lesson) return <Card><CardContent className="py-12 text-center"><h1 className="text-xl font-bold">Lesson not found</h1><Button asChild variant="link"><Link to="/">Back home</Link></Button></CardContent></Card>;
  const canReview = role !== 'Contributor' && lesson.status === queueStatus[role] && isAssignedTo(lesson, role, actor);
  const canEdit = lesson.submittedBy === actor && ['Draft', 'Changes requested'].includes(lesson.status);
  // Each reviewer picks only the next approver: Reviewer 1 → SME, SME → Quality Manager.
  const approverPick = role === 'Reviewer 1' ? { people: 'sme' as const, label: 'Level 2 SME', current: lesson.sme ?? '' } : role === 'SME' ? { people: 'qualityManager' as const, label: 'Quality Manager Approver', current: lesson.qualityManager ?? '' } : null;
  const approverValue = nextApprover ?? approverPick?.current ?? '';
  const onDecide = async () => {
    if (role === 'Contributor' || !canReview) return;
    if (decision !== 'advance' && !comment.trim()) { toast.error('Add a reason before returning or rejecting.'); return; }
    if (decision === 'advance' && approverPick && !approverValue) { toast.error(`Select the ${approverPick.label} before approving.`); return; }
    const audience: ReviewAudience = internal && decision === 'advance' ? 'Reviewers only' : 'Contributor and reviewers';
    setSaving(true);
    const saved = await reviewLesson(lesson.id, decision, comment, audience, approverValue);
    setSaving(false);
    if (!saved) return;
    toast.success(decision === 'advance' ? (role === 'Final reviewer' ? 'Lesson published.' : `Sent to ${nextLabel[role]}.`) : decision === 'return' ? 'Returned to the contributor.' : 'Lesson rejected.');
    navigate('/');
  };
  const openFile = (file: File) => { const url = URL.createObjectURL(file); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); };
  return <div className="space-y-6">
    <div className="border-b bg-white px-1 pb-6"><Link to={role === 'Contributor' ? '/' : '/'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Home</Link><div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant={lesson.status === 'Approved' ? 'default' : lesson.status === 'Rejected' ? 'destructive' : 'secondary'}>{canReview ? `Waiting on you · ${lesson.status}` : lesson.status}</Badge><Badge variant="outline">{lesson.topic ?? 'Improvement Practice'}</Badge></div><h1 className="mt-3 text-3xl font-bold tracking-tight">{lesson.title || 'Untitled draft'}</h1></div>
    {canReview && <ResubmissionNote lesson={lesson} />}
    <PdfLessonReview key={lesson.id} lesson={lesson} canAnnotate={canReview} canReply={role === 'Contributor' && canEdit}
      attachments={<>{Boolean(lesson.attachments?.length) && <Card><CardContent className="pt-5"><h2 className="text-xs font-bold tracking-wider text-muted-foreground">ATTACHMENTS</h2><div className="mt-3 flex flex-wrap gap-2">{lesson.attachments?.map((file, index) => <Button key={`${file.name}-${index}`} variant="outline" size="sm" onClick={() => openFile(file)}><Paperclip className="size-3" />{file.name}</Button>)}</div></CardContent></Card>}</>}
      renderSidebar={(pdfComments, hasDraft) => (
      <div className="space-y-5">
        {canReview && <Card className="border-2 border-slate-900"><CardContent className="space-y-4 pt-6"><div><h2 className="text-xl font-bold">Your decision</h2><p className="mt-1 text-sm text-muted-foreground">{role === 'Reviewer 1' ? 'Step 1' : role === 'SME' ? 'Step 2' : 'Step 3'} of 3 · {lesson.status}</p></div><div className="space-y-2">{([['advance', 'Approve', `Send to ${nextLabel[role]}`], ['return', 'Request changes', 'Back to the contributor with your notes. They can edit and resubmit.'], ['reject', 'Reject', 'Close the lesson. A reason is required.']] as const).map(([value,label,hint]) => <button key={value} type="button" onClick={() => setDecision(value)} className={`flex w-full gap-3 rounded-lg border p-4 text-left ${decision === value ? 'border-green-700 bg-green-50 ring-1 ring-green-700' : 'hover:bg-slate-50'}`}><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${decision === value ? 'border-green-700 bg-green-700 text-white' : 'border-slate-400'}`}>{decision === value && <Check className="size-3" />}</span><span><strong>{label}</strong><span className="mt-1 block text-xs text-muted-foreground">{hint}</span></span></button>)}</div>{pdfComments}<div><label htmlFor="decision-comment" className="text-sm font-semibold">Overall review summary</label><Textarea id="decision-comment" className="mt-2" rows={5} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a specific note" /><p className="mt-1 text-xs text-muted-foreground">Optional when approving · required otherwise</p></div>{decision === 'advance' && approverPick && <PersonSelect id="next-approver" label={approverPick.label} required people={approverPick.people} value={approverValue} onChange={setNextApprover} />}{decision === 'advance' && <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Keep the overall summary within the review team</label>}<Button className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300" disabled={hasDraft || saving} onClick={() => void onDecide()}>{decision === 'advance' ? role === 'Final reviewer' ? 'Approve & publish' : `Approve and send to ${nextLabel[role]}` : decision === 'return' ? 'Request changes' : 'Reject lesson'}</Button>{hasDraft && <p className="text-xs text-amber-800">Add or cancel your draft PDF comment before submitting your decision.</p>}</CardContent></Card>}
        {!canReview && <Card><CardContent className="pt-5">{pdfComments}</CardContent></Card>}
        {canEdit && <Button asChild className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300"><Link to={`/new?edit=${lesson.id}`}>{lesson.status === 'Changes requested' ? 'Edit PDF & resubmit' : 'Edit draft'}</Link></Button>}
        <LessonHistory lesson={lesson} contributorView={role === 'Contributor'} />
      </div>
      )}
    />
  </div>;
}
