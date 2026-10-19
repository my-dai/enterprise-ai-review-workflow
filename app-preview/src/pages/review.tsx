import { useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { LessonHistory, LessonProgress } from '@/components/lesson-history';
import { ResubmissionNote } from '@/components/resubmission-note';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { InMemoryDataBanner } from '@/generated/components/in-memory-data-banner';
import { HAS_IN_MEMORY_TABLES } from '@/generated/hooks';
import { isAssignedTo, queueStatus, useWorkflow, type LessonRecord, type ReviewAudience, type Role } from '@/lib/workflow-data';

const details: Record<Exclude<Role, 'Contributor'>, { eyebrow: string; title: string; description: string; primary: string; prompt: string }> = {
  'Reviewer 1': { eyebrow: 'LEVEL 1 · INITIAL REVIEW', title: 'Check clarity and completeness', description: 'Confirm the lesson is understandable and the proposed action is specific.', primary: 'Send to SME', prompt: 'What should the SME verify, or what should the contributor change?' },
  SME: { eyebrow: 'LEVEL 2 · TECHNICAL REVIEW', title: 'Validate the recommendation', description: 'See Reviewer 1 feedback, then check the technical details and practical impact.', primary: 'Send to final reviewer', prompt: 'What did you validate, or what needs correction?' },
  'Final reviewer': { eyebrow: 'FINAL REVIEW · PUBLISH', title: 'Publication decisions', description: 'Read the full review history and make the final decision.', primary: 'Approve & publish', prompt: 'Decision rationale or publication note' },
};
const checklists: Record<Exclude<Role, 'Contributor'>, string[]> = {
  'Reviewer 1': ['Context is complete', 'Lesson is clear', 'Recommended action is specific'],
  SME: ['Technical details are accurate', 'Action is practical', 'Expected impact is credible'],
  'Final reviewer': ['Prior reviews are complete', 'Publication wording is ready'],
};

export default function ReviewPage({ finalOnly = false }: { finalOnly?: boolean }) {
  const { role, lessons, reviewLesson, actor } = useWorkflow();
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [audiences, setAudiences] = useState<Record<string, ReviewAudience>>({});
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  if (role === 'Contributor' || (finalOnly && role !== 'Final reviewer') || (!finalOnly && role === 'Final reviewer')) {
    return <Card><CardContent className="py-10 text-center"><h1 className="text-xl font-semibold">Choose your review workspace</h1><p className="mt-2 text-muted-foreground">Use the role switcher in the top right to open the matching queue.</p></CardContent></Card>;
  }
  const config = details[role];
  const queue = lessons.filter((item) => item.status === queueStatus[role] && isAssignedTo(item, role, actor) && [item.id, item.title, item.project].join(' ').toLowerCase().includes(query.toLowerCase()));
  const submit = (item: LessonRecord, action: 'advance' | 'return') => {
    const comment = notes[item.id]?.trim() ?? '';
    if (action === 'return' && !comment) { toast.error('Add a specific change request for the contributor.'); return; }
    if (action === 'advance' && checklists[role].some((check) => !checks[item.id]?.includes(check))) { toast.error('Complete the review checklist before advancing.'); return; }
    reviewLesson(item.id, action, comment, action === 'return' ? 'Contributor and reviewers' : audiences[item.id] ?? 'Reviewers only');
    setNotes((current) => ({ ...current, [item.id]: '' }));
    toast.success(action === 'return' ? 'Returned to contributor with feedback.' : role === 'Final reviewer' ? 'Lesson published.' : 'Lesson sent to the next reviewer.');
  };
  return <div>
    <InMemoryDataBanner show={HAS_IN_MEMORY_TABLES} message="This app uses draft tables for testing. Data entered won't be saved. Contact the app owner to enable storage." />
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-muted-foreground">{config.eyebrow}</p><h1 className="text-2xl font-bold">{config.title}</h1><p className="text-muted-foreground">{config.description}</p></div>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this queue" /></div>
    </div>
    {role === 'Final reviewer' && <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {[['Awaiting decision', lessons.filter((item) => item.status === 'Final review').length], ['Published', lessons.filter((item) => item.status === 'Approved').length], ['Returned for changes', lessons.filter((item) => item.status === 'Changes requested').length]].map(([label, count]) => <Card key={label}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold">{count}</p></CardContent></Card>)}
    </div>}
    {queue.length === 0 ? <Card><CardContent className="py-10 text-center"><h2 className="font-semibold">Your queue is clear</h2><p className="mt-2 text-sm text-muted-foreground">{query ? 'Try another search.' : 'Lessons will appear here when the previous stage sends them on.'}</p></CardContent></Card> : <div className="space-y-6">
      {queue.map((item) => <Card key={item.id} className="overflow-hidden">
        <CardContent className="space-y-6 pt-6">
          <div><div className="mb-2 flex flex-wrap gap-2"><Badge variant="secondary">{item.id}</Badge><Badge variant="outline">{item.status}</Badge></div><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.project} · {item.discipline} · submitted by {item.submittedBy}</p></div>
          <LessonProgress lesson={item} />
          <ResubmissionNote lesson={item} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {([['What happened?', item.situation], ['What did we learn?', item.lesson], ['Recommended action', item.recommendation], ['Expected impact', item.impact]] as const).map(([label, value]) => <div key={label} className="rounded-md bg-muted/50 p-4"><h3 className="text-sm font-semibold">{label}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p></div>)}
              </div>
              {role === 'Final reviewer' && <div className="rounded-md border border-primary/30 bg-primary/5 p-4"><h3 className="font-semibold">Publication preview</h3><p className="mt-2 text-sm font-medium">{item.title}</p><p className="mt-2 text-sm text-muted-foreground">{item.recommendation}</p><p className="mt-2 text-xs text-muted-foreground">{item.project} · {item.category} · {item.discipline}</p></div>}
              <LessonHistory lesson={item} />
            </div>
            <div className="h-fit space-y-4 rounded-md border bg-muted/30 p-5">
              <div><h3 className="font-semibold">Your decision</h3><p className="mt-1 text-sm text-muted-foreground">{config.prompt}</p></div>
              <fieldset className="space-y-3"><legend className="text-sm font-semibold">{role === 'Reviewer 1' ? 'Completeness check' : role === 'SME' ? 'Technical validation' : 'Publication check'}</legend>{checklists[role].map((check) => <label key={check} className="flex items-start gap-2 text-sm"><Checkbox checked={checks[item.id]?.includes(check) ?? false} onCheckedChange={(checked) => setChecks((current) => ({ ...current, [item.id]: checked ? [...(current[item.id] ?? []), check] : (current[item.id] ?? []).filter((value) => value !== check) }))} /><span>{check}</span></label>)}</fieldset>
              <div><Label htmlFor={`note-${item.id}`}>Review comment</Label><Textarea id={`note-${item.id}`} className="mt-2 bg-background" rows={5} value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Write a clear, actionable note" /></div>
              <div><Label htmlFor={`audience-${item.id}`}>Comment visibility when advancing</Label><Select value={audiences[item.id] ?? 'Reviewers only'} onValueChange={(value) => setAudiences((current) => ({ ...current, [item.id]: value as ReviewAudience }))}><SelectTrigger id={`audience-${item.id}`} className="mt-2 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Reviewers only">Reviewers only</SelectItem><SelectItem value="Contributor and reviewers">Contributor and reviewers</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Change requests are always visible to the contributor.</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => submit(item, 'return')}>Request changes</Button><Button onClick={() => submit(item, 'advance')}><CheckCircle2 className="size-4" />{config.primary}</Button></div>
            </div>
          </div>
        </CardContent>
      </Card>)}
    </div>}
  </div>;
}
