import { useMemo, useState } from 'react';
import { Check, CircleAlert, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Stage = 'DRAFT' | 'QUALITY_CHECK' | 'SUPERVISOR_REVIEW' | 'SME_REVIEW' | 'QUALITY_REVIEW' | 'REVISION_REQUESTED' | 'PUBLISHED';
type Result = { label: string; detail: string; level: 'pass' | 'warn' | 'fail' };

const steps: { key: Exclude<Stage, 'REVISION_REQUESTED'>; title: string; owner: string }[] = [
  { key: 'DRAFT', title: 'Draft', owner: 'Contributor' },
  { key: 'QUALITY_CHECK', title: 'Quality check', owner: 'Automated feedback' },
  { key: 'SUPERVISOR_REVIEW', title: 'Supervisor', owner: 'First approval' },
  { key: 'SME_REVIEW', title: 'SME', owner: 'When required' },
  { key: 'QUALITY_REVIEW', title: 'Quality director', owner: 'Final approval' },
  { key: 'PUBLISHED', title: 'Published', owner: 'Approved library' },
];
const labels: Record<Stage, string> = { DRAFT: 'Draft', QUALITY_CHECK: 'Quality check complete', SUPERVISOR_REVIEW: 'Supervisor review', SME_REVIEW: 'SME review', QUALITY_REVIEW: 'Quality director review', REVISION_REQUESTED: 'Revision requested', PUBLISHED: 'Published' };
const owners: Record<Stage, string> = { DRAFT: 'Contributor', QUALITY_CHECK: 'Contributor', SUPERVISOR_REVIEW: 'Supervisor', SME_REVIEW: 'Subject matter expert', QUALITY_REVIEW: 'Quality director', REVISION_REQUESTED: 'Contributor', PUBLISHED: 'Approved Lessons Library' };

export default function WorkflowPage() {
  const [stage, setStage] = useState<Stage>('DRAFT');
  const [needsSme, setNeedsSme] = useState(true);
  const [comment, setComment] = useState('');
  const [latestNote, setLatestNote] = useState('No revision has been requested.');
  const [results, setResults] = useState<Result[]>([]);
  const [title, setTitle] = useState('Use tagged photographs for flange inspections');
  const [description, setDescription] = useState('Inspection photographs were stored without consistent tags, which made final closeout verification difficult.');
  const [lesson, setLesson] = useState('Use a standard photo tag at every required flange inspection checkpoint.');
  const [action, setAction] = useState('Attach tagged photographs to the inspection record before each checkpoint is closed.');
  const [events, setEvents] = useState<string[]>(['Lesson created in Draft state.']);

  const hasBlocker = results.some((result) => result.level === 'fail');
  const stepIndex = stage === 'REVISION_REQUESTED' ? 2 : steps.findIndex((step) => step.key === stage);
  const guidance = useMemo(() => ({
    DRAFT: 'Complete the lesson and review the quality feedback before submission.', QUALITY_CHECK: 'Resolve blocking issues and review possible related lessons.', SUPERVISOR_REVIEW: 'Supervisor reviews the lesson and quality results.', SME_REVIEW: 'SME reviews technical accuracy and the proposed corrective action.', QUALITY_REVIEW: 'Quality Director makes the final publication decision.', REVISION_REQUESTED: 'Update the requested fields, then resubmit for review.', PUBLISHED: 'The approved lesson is now available in the searchable library.',
  })[stage], [stage]);
  const addEvent = (message: string) => setEvents((current) => [message, ...current]);
  const move = (next: Stage, message: string) => { setStage(next); addEvent(message); };
  const runChecks = () => {
    const missing = [title, description, lesson, action].filter((value) => !value.trim()).length;
    const related = /flange|inspection photo|tagged photograph/i.test(`${title} ${lesson}`);
    const next = [
      { label: 'Required fields', detail: missing ? `${missing} required field(s) missing` : 'All required fields completed', level: missing ? 'fail' as const : 'pass' as const },
      { label: 'Draft detail', detail: [description, lesson, action].filter((value) => value.trim().length < 35).length ? 'Some fields may need more detail' : 'Narrative fields contain useful detail', level: [description, lesson, action].filter((value) => value.trim().length < 35).length ? 'warn' as const : 'pass' as const },
      { label: 'Existing lesson search', detail: related ? 'One possible related lesson found: LL-1031' : 'No close match in the approved library', level: related ? 'warn' as const : 'pass' as const },
      { label: 'Contradiction check', detail: 'No contradictory outcome identified', level: 'pass' as const },
    ];
    setResults(next); move('QUALITY_CHECK', 'Quality and validation checks completed.'); toast.success('Quality check complete.');
  };
  const approve = () => {
    if (comment.trim()) setLatestNote(comment.trim());
    if (stage === 'SUPERVISOR_REVIEW') move(needsSme ? 'SME_REVIEW' : 'QUALITY_REVIEW', needsSme ? 'Supervisor approved; routed to SME.' : 'Supervisor approved; routed to Quality Director.');
    else if (stage === 'SME_REVIEW') move('QUALITY_REVIEW', 'SME approved; routed to Quality Director.');
    else if (stage === 'QUALITY_REVIEW') move('PUBLISHED', 'Quality Director approved; lesson published to the library.');
    setComment(''); toast.success('Approval recorded.');
  };
  const requestRevision = () => { setLatestNote(comment.trim() || 'Reviewer requested clarification before approval.'); setComment(''); move('REVISION_REQUESTED', `${labels[stage]} returned the lesson for revision.`); toast.warning('Lesson returned for revision.'); };
  const resubmit = () => { setResults([]); move('DRAFT', 'Contributor updated the lesson; quality checks must run again.'); };

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-muted-foreground">END-TO-END WORKFLOW</p><h1 className="text-2xl font-bold">Lesson LL-1042 approval flow</h1><p className="text-muted-foreground">Track a submission from drafting through final publication.</p></div>
    <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-6">{steps.map((step, index) => { const active = step.key === stage || (stage === 'REVISION_REQUESTED' && step.key === 'SUPERVISOR_REVIEW'); const done = index < stepIndex; const skipped = step.key === 'SME_REVIEW' && !needsSme; return <div key={step.key} className={`rounded-lg border p-3 ${active ? 'border-primary bg-primary/10 ring-1 ring-primary' : done ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted/40'} ${skipped ? 'opacity-40' : ''}`}><p className="text-xs text-muted-foreground">0{index + 1}</p><p className="mt-1 font-semibold">{step.title}</p><p className="text-xs text-muted-foreground">{step.owner}</p></div>; })}</CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]"><Card><CardHeader><CardTitle>Submission</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="workflow-title">Lesson title *</Label><Input id="workflow-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="md:col-span-2"><Label htmlFor="workflow-description">Description / What happened? *</Label><Textarea id="workflow-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div><div><Label htmlFor="workflow-lesson">Lesson learned *</Label><Textarea id="workflow-lesson" rows={4} value={lesson} onChange={(event) => setLesson(event.target.value)} /></div><div><Label htmlFor="workflow-action">Preventative / corrective action *</Label><Textarea id="workflow-action" rows={4} value={action} onChange={(event) => setAction(event.target.value)} /></div><div className="md:col-span-2 flex items-center gap-3"><Checkbox id="needs-sme" checked={needsSme} onCheckedChange={(value) => setNeedsSme(value === true)} disabled={stage !== 'DRAFT' && stage !== 'QUALITY_CHECK' && stage !== 'REVISION_REQUESTED'} /><Label htmlFor="needs-sme">Technical content requires SME review</Label></div><div className="md:col-span-2"><Label htmlFor="workflow-note">Reviewer comment</Label><Textarea id="workflow-note" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Enter an approval note or specific revision request" /></div><div className="md:col-span-2 flex flex-wrap gap-2"><Button type="button" onClick={runChecks} disabled={!['DRAFT', 'QUALITY_CHECK', 'REVISION_REQUESTED'].includes(stage)}>Run quality check</Button><Button type="button" onClick={() => move('SUPERVISOR_REVIEW', 'Contributor submitted the lesson to Supervisor.')} disabled={stage !== 'QUALITY_CHECK' || hasBlocker}>Submit for supervisor review</Button><Button type="button" onClick={approve} disabled={!['SUPERVISOR_REVIEW', 'SME_REVIEW', 'QUALITY_REVIEW'].includes(stage)}>Approve current stage</Button><Button type="button" variant="destructive" onClick={requestRevision} disabled={!['SUPERVISOR_REVIEW', 'SME_REVIEW', 'QUALITY_REVIEW'].includes(stage)}>Return for revision</Button><Button type="button" variant="outline" onClick={resubmit} disabled={stage !== 'REVISION_REQUESTED'}>Resubmit revision</Button></div></CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Current status</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-md bg-primary/10 p-4"><p className="font-semibold text-primary">{labels[stage]}</p><p className="mt-1 text-sm text-muted-foreground">Current owner: {owners[stage]}</p></div><p className="text-sm text-muted-foreground">{guidance}</p><div><div className="mb-2 flex items-center justify-between"><p className="font-medium">Quality & validation</p><Badge variant="outline"><Search className="mr-1 size-3" />Library check</Badge></div><div className="space-y-2">{results.length ? results.map((result) => <div key={result.label} className="flex gap-3 rounded-md bg-muted p-3 text-sm"><span className={result.level === 'pass' ? 'text-emerald-600' : result.level === 'warn' ? 'text-amber-600' : 'text-destructive'}>{result.level === 'pass' ? <Check className="size-4" /> : <CircleAlert className="size-4" />}</span><div><p className="font-medium">{result.label}</p><p className="text-muted-foreground">{result.detail}</p></div></div>) : <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Checks have not been run.</p>}</div></div><div><p className="font-medium">Latest review note</p><p className="mt-1 border-l-4 border-primary pl-3 text-sm text-muted-foreground">{latestNote}</p></div></CardContent></Card><Card><CardHeader><CardTitle>Audit trail</CardTitle></CardHeader><CardContent><ol className="space-y-3">{events.map((event, index) => <li key={`${event}-${index}`} className="border-b pb-3 text-sm last:border-0"><span className="mr-2 text-xs font-semibold text-muted-foreground">{events.length - index}.</span>{event}</li>)}</ol></CardContent></Card></div></div>
  </div>;
}
