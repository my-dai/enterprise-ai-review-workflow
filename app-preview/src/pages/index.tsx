import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LessonProgress } from '@/components/lesson-history';
import { DeleteDraftButton } from '@/components/delete-draft-button';
import { isAssignedTo, queueStatus, stages, submittedDate, useWorkflow, type LessonRecord, type Role } from '@/lib/workflow-data';

const person: Record<Role, { eyebrow: string }> = {
  Contributor: { eyebrow: 'SUBMITTER VIEW' },
  'Reviewer 1': { eyebrow: 'REVIEWER VIEW · LEVEL 1 MANAGER' },
  SME: { eyebrow: 'SME VIEW · TECHNICAL REVIEW' },
  'Final reviewer': { eyebrow: 'APPROVER VIEW · QUALITY MANAGER' },
};
const daysWaiting = (lesson: LessonRecord) => {
  const last = lesson.history.at(-1)?.at;
  return last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000)) : 0;
};
const stageLabel = (status: LessonRecord['status']) => status === 'Reviewer 1 review' ? 'Manager review' : status === 'Final review' ? 'Final approval' : status;
type Tone = 'amber' | 'slate' | 'blue' | 'green';
const glowRgb: Record<Tone, string> = { amber: '180 83 9', slate: '100 116 139', blue: '37 99 235', green: '21 128 61' };
// A card either points at a section on this page (scroll + glow its lessons) or links to another page.
type MetricSpec = { label: string; detail: string; tone?: Tone; lessons: LessonRecord[]; section?: string; to?: string };
type Glow = { section: string; ids: Set<string>; tone: Tone };
const GlowContext = createContext<Glow | null>(null);
const useGlowRow = (id: string) => useContext(GlowContext)?.ids.has(id) ? 'glow-row' : '';
function Metric({ label, value, detail, tone = 'blue', onClick }: { label: string; value: string | number; detail: string; tone?: Tone; onClick: () => void }) {
  const colors = { amber: 'border-t-amber-700 text-amber-800', slate: 'border-t-slate-500 text-slate-600', blue: 'border-t-blue-600 text-blue-700', green: 'border-t-green-700 text-green-700' };
  return <button type="button" onClick={onClick} className={`block h-full w-full cursor-pointer rounded-xl border border-t-4 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${colors[tone]}`}><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-4xl font-bold text-slate-900">{value}</p><p className="mt-2 text-xs font-semibold">{detail}</p></button>;
}
function Section({ id, title, aside, children }: { id?: string; title: string; aside?: string; children: React.ReactNode }) {
  const glow = useContext(GlowContext);
  const empty = glow && id && glow.section === id && !glow.ids.size ? 'glow-box' : '';
  return <section id={id && `home-${id}`} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${empty}`}><div className="flex flex-wrap items-center gap-3 border-b px-5 py-4"><h2 className="text-lg font-bold">{title}</h2>{aside && <span className="text-sm text-muted-foreground">{aside}</span>}</div>{children}</section>;
}
function QueueRow({ item, action }: { item: LessonRecord; action: 'Review' | 'View' }) {
  const navigate = useNavigate();
  const { nameOf } = useWorkflow();
  return <tr className={`border-t ${useGlowRow(item.id)}`}><td className="max-w-72 px-5 py-4"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.topic ?? 'Improvement Practice'}</p></td><td className="px-4 py-4">{nameOf(item.submittedBy)}</td><td className="px-4 py-4"><Badge variant="secondary">{stageLabel(item.status)}</Badge></td><td className="px-4 py-4">{submittedDate(item)}</td><td className="px-5 py-4 text-right"><Button size="sm" variant={action === 'Review' ? 'default' : 'outline'} onClick={() => navigate(`/lessons/${item.id}`)}>{action}</Button></td></tr>;
}
function QueueTable({ lessons, action = 'Review' }: { lessons: LessonRecord[]; action?: 'Review' | 'View' }) {
  if (!lessons.length) return <p className="px-5 py-8 text-sm text-muted-foreground">Nothing is waiting here right now.</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Lesson</th><th className="px-4 py-3">Submitted by</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Submitted</th><th className="px-5 py-3" /></tr></thead><tbody>{lessons.map((item) => <QueueRow key={item.id} item={item} action={action} />)}</tbody></table></div>;
}
function MySubmissions({ lessons }: { lessons: LessonRecord[] }) {
  const { actor, lessons: allLessons } = useWorkflow();
  const own = allLessons.filter((item) => item.submittedBy === actor);
  const visible = own.length ? own : lessons;
  return <Section title="My submissions" aside="Demo records"><div className="divide-y">{visible.slice(0, 3).map((item) => <Link key={item.id} to={`/lessons/${item.id}`} className="block px-5 py-4 hover:bg-slate-50"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><Badge variant="secondary">{stageLabel(item.status)}</Badge></div><p className="mt-2 font-semibold">{item.title || 'Untitled draft'}</p></Link>)}{!visible.length && <p className="px-5 py-6 text-sm text-muted-foreground">No submissions yet.</p>}</div></Section>;
}
export default function HomePage() {
  const { role, lessons, actor, nameOf } = useWorkflow();
  const navigate = useNavigate();
  const p = person[role];
  const mine = lessons.filter((item) => item.submittedBy === actor);
  const scoped = role === 'Contributor' ? mine : lessons.filter((item) => isAssignedTo(item, role, actor));
  const needs = scoped.filter((item) => item.status === 'Changes requested');
  const drafts = scoped.filter((item) => item.status === 'Draft');
  const inReview = scoped.filter((item) => ['Reviewer 1 review', 'SME review', 'Final review'].includes(item.status));
  const approved = scoped.filter((item) => item.status === 'Approved');
  const queue = role === 'Contributor' ? [] : lessons.filter((item) => item.status === queueStatus[role] && isAssignedTo(item, role, actor));
  const overdue = queue.filter((item) => daysWaiting(item) >= 5);
  // Lessons this reviewer approved that are still moving through later stages.
  const onward = role === 'Contributor' ? [] : inReview.filter((item) => stages.indexOf(item.status) > stages.indexOf(queueStatus[role]));
  const library: MetricSpec = { label: 'Approved lessons', detail: role === 'Contributor' ? 'Ready for everyone to use' : 'Lessons you reviewed', tone: 'green', lessons: approved, to: '/library' };
  const returned: MetricSpec = { label: 'Needs changes', detail: 'Returned to contributors', tone: 'slate', lessons: needs, section: 'returned' };
  const waiting: MetricSpec = { label: role === 'Final reviewer' ? 'Ready for final approval' : 'Waiting on your review', detail: `${overdue.length} overdue (5+ days)`, tone: 'amber', lessons: queue, section: 'queue' };
  const metrics: MetricSpec[] = role === 'Contributor'
    ? [{ label: 'Needs your changes', detail: 'Returned with reviewer feedback', tone: 'amber', lessons: needs, section: 'attention' }, { label: 'Draft', detail: 'Not submitted yet', tone: 'slate', lessons: drafts, section: 'attention' }, { label: 'In review', detail: 'Follow each stage below', lessons: inReview, section: 'in-review' }, library]
    : role === 'Final reviewer'
      ? [waiting, returned, library]
      : [waiting, { label: 'Sent onward', detail: role === 'SME' ? 'Still in final review' : 'Still in SME or final review', lessons: onward, section: 'onward' }, returned, library];

  const [glow, setGlow] = useState<Glow | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const activate = (metric: MetricSpec) => {
    if (metric.to) { navigate(metric.to); return; }
    if (!metric.section) return;
    document.getElementById(`home-${metric.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Clear first so a repeat click restarts the animation.
    setGlow(null);
    window.clearTimeout(timer.current);
    const next = { section: metric.section, ids: new Set(metric.lessons.map((item) => item.id)), tone: metric.tone ?? 'blue' };
    requestAnimationFrame(() => setGlow(next));
    timer.current = window.setTimeout(() => setGlow(null), 1900);
  };
  const glowRow = (id: string) => glow?.ids.has(id) ? 'glow-row' : '';

  return <GlowContext.Provider value={glow}><div className="space-y-7" style={glow ? { '--glow': glowRgb[glow.tone] } as CSSProperties : undefined}>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><span className={`inline-block rounded px-2.5 py-1 text-xs font-bold tracking-wider text-white ${role === 'Contributor' ? 'bg-slate-600' : role === 'SME' ? 'bg-teal-700' : role === 'Final reviewer' ? 'bg-amber-800' : 'bg-blue-700'}`}>{p.eyebrow}</span></div><div className="flex flex-col items-stretch gap-2"><Button asChild className="bg-amber-400 text-slate-950 hover:bg-amber-300"><Link to="/new"><Plus className="size-4" />New Lessons Learned</Link></Button><Button asChild variant="outline"><Link to="/import">Batch upload</Link></Button></div></div>
    <div className={`grid gap-4 sm:grid-cols-2 ${metrics.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>{metrics.map((metric) => <Metric key={metric.label} label={metric.label} value={metric.lessons.length} detail={metric.detail} tone={metric.tone} onClick={() => activate(metric)} />)}</div>
    {role === 'Contributor' ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,.75fr)]"><div className="space-y-6"><Section id="attention" title="Needs your attention"><div className="divide-y">{[...needs, ...drafts].map((item) => { const note = [...item.history].reverse().find((entry) => entry.action === 'Requested changes'); return <div key={item.id} className={`px-5 py-5 ${glowRow(item.id)}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant={item.status === 'Changes requested' ? 'destructive' : 'secondary'}>{item.status === 'Changes requested' ? 'Needs changes' : 'Draft'}</Badge></div><div className="flex flex-wrap gap-2">{item.status === 'Changes requested' && <Button asChild size="sm" variant="outline"><Link to={`/lessons/${item.id}`}>View PDF feedback{Boolean(item.pdfComments?.length) && ` (${item.pdfComments?.length})`}</Link></Button>}{item.status === 'Draft' && <DeleteDraftButton lessonId={item.id} title={item.title} />}<Button asChild size="sm" variant={item.status === 'Changes requested' ? 'default' : 'outline'}><Link to={`/new?edit=${item.id}`}>{item.status === 'Changes requested' ? 'Edit PDF & resubmit' : 'Continue draft'}</Link></Button></div></div><p className="mt-3 font-semibold">{item.title || 'Untitled draft'}</p>{note?.comment && <p className="mt-3 rounded-md border-l-4 border-amber-700 bg-amber-50 p-3 text-sm">“{note.comment}”</p>}</div>; })}{needs.length + drafts.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground">You are all caught up.</p>}</div></Section><Section id="in-review" title="In review · where are my lessons?"><div className="divide-y">{inReview.map((item) => <Link to={`/lessons/${item.id}`} key={item.id} className={`block space-y-3 px-5 py-4 hover:bg-slate-50 ${glowRow(item.id)}`}><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="text-sm text-muted-foreground">With {stageLabel(item.status)} · Submitted {submittedDate(item)}</span></div><LessonProgress lesson={item} /></Link>)}{inReview.length === 0 && <p className="px-5 py-8 text-sm text-muted-foreground">No lessons in review.</p>}</div></Section></div><div className="space-y-6"><Section title="Recently approved"><div className="divide-y">{approved.slice(0, 3).map((item) => <Link key={item.id} to={`/lessons/${item.id}`} className="block px-5 py-4 hover:bg-slate-50"><p className="font-mono text-xs text-muted-foreground">{item.discipline}</p><p className="mt-1 font-semibold">{item.title}</p></Link>)}</div></Section></div></div>
      : <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,.75fr)]"><div className="space-y-6"><Section id="queue" title={role === 'Final reviewer' ? 'Ready for your final approval' : 'Waiting on your review'} aside={`${queue.length} lessons`}><QueueTable lessons={queue} /></Section>{role !== 'Final reviewer' && <Section id="onward" title="Sent onward" aside="You approved these; still in review"><QueueTable lessons={onward} action="View" /></Section>}<Section id="returned" title="Needs changes" aside="Returned to contributors"><QueueTable lessons={needs} action="View" /></Section></div><div className="space-y-6">{role === 'Final reviewer' ? <Section title="Pipeline" aside="All stages"><div className="space-y-4 p-5">{[['Manager review', lessons.filter((item) => item.status === 'Reviewer 1 review').length], ['SME review', lessons.filter((item) => item.status === 'SME review').length], ['Final review', queue.length], ['Needs changes', needs.length]].map(([label, count]) => <div key={label} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><span className="font-bold">{count}</span></div>)}<Button asChild variant="outline" className="w-full"><Link to="/pipeline">Open pipeline<ArrowRight className="size-4" /></Link></Button></div></Section> : role === 'SME' ? <Section title="Discipline library"><div className="p-5"><p className="text-3xl font-bold">{approved.length}</p><p className="mt-1 text-sm text-muted-foreground">approved lessons</p><Button asChild variant="link" className="mt-3 px-0"><Link to="/library">Explore approved lessons<ArrowRight className="size-4" /></Link></Button></div></Section> : <Section title="Team contributions"><div className="divide-y">{[...new Set(lessons.map((item) => item.submittedBy))].slice(0, 4).map((name) => <div key={name} className="flex justify-between px-5 py-3 text-sm"><span>{nameOf(name)}</span><strong>{lessons.filter((item) => item.submittedBy === name).length}</strong></div>)}</div></Section>}<MySubmissions lessons={lessons.filter((item) => item.submittedBy === 'Demo contributor')} /></div></div>}
  </div></GlowContext.Provider>;
}
