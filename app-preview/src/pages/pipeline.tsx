import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { submittedDate, useWorkflow, type LessonRecord } from '@/lib/workflow-data';

const columns: { title: string; status: LessonRecord['status'] }[] = [
  { title: 'Manager review', status: 'Reviewer 1 review' },
  { title: 'SME review', status: 'SME review' },
  { title: 'Final review', status: 'Final review' },
  { title: 'Needs changes', status: 'Changes requested' },
];
export default function PipelinePage() {
  const { role, lessons, nameOf } = useWorkflow();
  if (role !== 'Final reviewer') return <Card><CardContent className="py-10 text-center">Switch to Final reviewer to open the approval pipeline.</CardContent></Card>;
  const visible = lessons;
  const inFlight = visible.filter((item) => columns.some((column) => column.status === item.status));
  const overdue = inFlight.filter((item) => { const at = item.history.at(-1)?.at; return at && Date.now() - new Date(at).getTime() >= 5 * 86400000; });
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Approval pipeline</h1><p className="mt-2 text-muted-foreground">{inFlight.length} lessons in flight · {overdue.length} waiting more than 5 days</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{columns.map((column) => { const items = visible.filter((item) => item.status === column.status); return <section key={column.status} className="min-h-64 rounded-xl bg-[#edeeec] p-3"><h2 className="flex justify-between px-1 py-2 text-sm font-bold"><span>{column.title}</span><span className="text-muted-foreground">{items.length}</span></h2><div className="space-y-3">{items.map((item) => { const last = item.history.at(-1); const days = last ? Math.max(0, Math.floor((Date.now() - new Date(last.at).getTime()) / 86400000)) : 0; return <Link key={item.id} to={`/lessons/${item.id}`} className={`block rounded-lg border bg-white p-4 shadow-sm hover:border-blue-500 ${days >= 5 ? 'border-l-4 border-l-amber-700' : ''}`}><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{item.topic || ''}</span><Badge variant={days >= 5 ? 'destructive' : 'secondary'}>{submittedDate(item)}</Badge></div><p className="mt-3 font-semibold leading-snug">{item.title}</p><p className="mt-3 text-xs text-muted-foreground">{column.status === 'Changes requested' ? nameOf(item.submittedBy) : nameOf(column.status === 'Reviewer 1 review' ? item.level1Manager : column.status === 'SME review' ? item.sme : item.qualityManager) || (column.status === 'Reviewer 1 review' ? 'Reviewer 1' : column.status === 'SME review' ? 'SME' : 'Final reviewer')}</p></Link>; })}{items.length === 0 && <p className="rounded-lg border border-dashed bg-white/60 p-4 text-sm text-muted-foreground">No lessons at this step.</p>}</div></section>; })}</div></div>;
}
