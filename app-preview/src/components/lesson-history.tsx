import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { stages, useWorkflow, type LessonRecord } from '@/lib/workflow-data';

export function LessonProgress({ lesson }: { lesson: LessonRecord }) {
  const { nameOf } = useWorkflow();
  const current = lesson.status === 'Changes requested' ? stages.indexOf(lesson.returnTo === 'SME' ? 'SME review' : lesson.returnTo === 'Final reviewer' ? 'Final review' : 'Reviewer 1 review') : stages.indexOf(lesson.status);
  const labels = ['Submitted', 'Manager', 'SME', 'Final', 'Published'];
  // The person assigned at each review step, shown under its label (SME and Final are picked as the lesson advances).
  const people = ['', nameOf(lesson.level1Manager), nameOf(lesson.sme), nameOf(lesson.qualityManager), ''];
  return <div aria-label="Lesson progress" className="flex items-center text-xs">
    {stages.map((stage, index) => <div key={stage} className="flex min-w-0 flex-1 items-center last:flex-none"><span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${index < current ? 'border-green-700 bg-green-700 text-white' : index === current ? 'border-blue-700 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-400'}`}>{index < current ? <Check className="size-3" /> : null}</span><span className="ml-1 min-w-0"><span className={`block truncate ${index === current ? 'font-bold text-blue-700' : 'text-muted-foreground'}`}>{labels[index]}</span>{people[index] && <span className="block truncate text-[10px] leading-tight text-muted-foreground">{people[index]}</span>}</span>{index < stages.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${index < current ? 'bg-green-700' : 'bg-slate-200'}`} />}</div>)}
  </div>;
}
export function LessonHistory({ lesson, contributorView = false }: { lesson: LessonRecord; contributorView?: boolean }) {
  const { nameOf } = useWorkflow();
  return <Card><CardContent className="pt-6"><h2 className="mb-5 text-lg font-bold">Approval history</h2><ol className="space-y-0">{lesson.history.map((entry, index) => <li key={entry.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-green-700 text-white"><Check className="size-4" /></span>{index < lesson.history.length - 1 && <span className="min-h-8 w-0.5 flex-1 bg-green-200" />}</div><div className="min-w-0 pb-5"><p className="text-sm font-semibold">{entry.action}</p><p className="mt-1 text-xs text-muted-foreground">{nameOf(entry.actor)} · <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString()}</time></p>{entry.comment && (!contributorView || entry.audience === 'Contributor and reviewers') && <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm leading-6">“{entry.comment}”</p>}{entry.comment && !contributorView && entry.audience === 'Reviewers only' && <p className="mt-1 text-xs text-muted-foreground">Internal review note</p>}</div></li>)}</ol>{!['Approved', 'Rejected', 'Changes requested', 'Draft'].includes(lesson.status) && <div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-blue-700 bg-blue-50" /><div><p className="text-sm font-semibold">{lesson.status}</p><p className="mt-1 text-xs text-muted-foreground">Current step</p></div></div>}</CardContent></Card>;
}
