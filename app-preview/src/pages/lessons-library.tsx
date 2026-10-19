import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { loadLibraryLessons } from '@/lib/lessons-library';
import { evidenceFields } from '@/lib/library-evidence';
import { useWorkflow, type LessonRecord } from '@/lib/workflow-data';

// Lessons Library. Two separate sources share this page for now:
// - "Recently published": lessons approved in this app and saved to the configured library.
// - The searchable list: the real lessons from the LessonsLearned site, each opening its PDF in SharePoint.
//   (Embedding the PDF in the page is blocked by the environment's content security policy.)
// Every lesson is loaded (search covers all of them); only the list on screen is paged.
const PAGE_SIZE = 10;

export default function LessonsLibraryPage() {
  const query = useQuery({ queryKey: ['lessons-library'], queryFn: loadLibraryLessons, staleTime: 10 * 60 * 1000 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const term = search.trim().toLowerCase();
  const all = query.data ?? [];
  const lessons = all.filter((item) => !term || evidenceFields.some((field) => (item[field] ?? '').toLowerCase().includes(term)) || String(item.id).includes(term));
  const pageCount = Math.max(1, Math.ceil(lessons.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = lessons.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const published = recentlyPublished(useWorkflow().lessons);
  const goTo = (next: number) => { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Lessons Library</h1>
    {published.length > 0 && <section aria-labelledby="recently-published" className="space-y-3">
      <h2 id="recently-published" className="text-lg font-bold">Recently published</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{published.map(({ lesson, at }) => <Link key={lesson.id} to={`/lessons/${lesson.id}`} className="group rounded-xl border bg-white p-4 shadow-sm transition hover:border-blue-500 hover:shadow-md">
        <div className="flex flex-wrap items-center gap-2"><Badge className="bg-green-100 text-green-800">Approved</Badge>{lesson.topic && <Badge variant="secondary">{lesson.topic}</Badge>}</div>
        <h3 className="mt-3 font-bold group-hover:text-blue-700">{lesson.title || 'Untitled lesson'}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{[lesson.discipline, at && `Published ${new Date(at).toLocaleDateString()}`].filter(Boolean).join(' · ')}</p>
      </Link>)}</div>
    </section>}
    <Card><CardContent className="space-y-4 pt-6">
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search lessons library" className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm" placeholder="Search titles, keywords and lesson content" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
        {query.isSuccess && <p className="text-sm text-muted-foreground">{term ? `${lessons.length} of ${all.length}` : all.length} lessons</p>}</div>
      {query.isPending && <p className="py-10 text-center text-sm text-muted-foreground">Loading lessons…</p>}
      {query.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">Could not load the library: {query.error.message}</p>}
      {query.isSuccess && !lessons.length && <p className="py-10 text-center text-sm text-muted-foreground">{all.length ? 'No lessons match your search.' : 'No lessons found.'}</p>}
      {Boolean(lessons.length) && <ul className="divide-y rounded-lg border">{shown.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">ID {item.id}</span>
        <span className="min-w-0 flex-1 font-medium">{item.title}</span>
        <Button asChild size="sm" variant="outline"><a href={item.pdf.link} target="_blank" rel="noreferrer" title={item.pdf.name}><ExternalLink className="size-4" />Open PDF</a></Button>
      </li>)}</ul>}
      {pageCount > 1 && <nav aria-label="Lessons library pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {lessons.length}</p>
        <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={current === 0} onClick={() => goTo(current - 1)}><ChevronLeft className="size-4" />Previous</Button><span className="px-2 text-muted-foreground">Page {current + 1} of {pageCount}</span><Button size="sm" variant="outline" disabled={current >= pageCount - 1} onClick={() => goTo(current + 1)}>Next<ChevronRight className="size-4" /></Button></div>
      </nav>}
    </CardContent></Card>
  </div>;
}

// The latest lessons approved in this app, newest first.
function recentlyPublished(lessons: LessonRecord[], count = 6) {
  return lessons
    .filter((lesson) => lesson.status === 'Approved')
    .map((lesson) => ({ lesson, at: [...lesson.history].reverse().find((event) => event.action === 'Approved and published')?.at }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, count);
}
