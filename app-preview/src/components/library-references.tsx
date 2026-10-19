import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { loadLibraryLessons } from '@/lib/lessons-library';
import { evidenceExcerpt, rankLibraryEvidence, type LibraryEvidence } from '@/lib/library-evidence';
const labels: Record<string, string> = { title: 'Title', keywords: 'Keywords', situation: 'Background', rootCause: 'Root cause', impact: 'Impact', recommendation: 'Lesson / corrective action' };

export function LibraryReferences({ initialQuery, selected, onSelect }: {
  initialQuery: string; selected: LibraryEvidence[]; onSelect: (items: LibraryEvidence[]) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['lessons-library'], queryFn: loadLibraryLessons, staleTime: 10 * 60 * 1000, enabled: opened });
  const matches = rankLibraryEvidence(search, query.data ?? []);
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Library references for this draft">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Use experience from the library</h3><p className="mt-1 text-xs text-muted-foreground">Compare source passages and optionally include up to three lessons in field revision requests.</p></div><Button type="button" size="sm" variant="outline" onClick={() => { setOpened(!opened); if (!opened && !search) setSearch(initialQuery); }}>{opened ? 'Hide library search' : 'Find related experience'}</Button></div>
    {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map((item) => <span key={item.id} className="rounded border bg-slate-50 px-2 py-1 text-xs">{item.title}<button type="button" className="ml-2 underline" onClick={() => onSelect(selected.filter((source) => source.id !== item.id))} aria-label={'Remove reference ' + item.title}>Remove</button></span>)}</div>}
    {opened && <>
      <input aria-label="Search library content" className="w-full rounded-md border bg-white p-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a cause, practice, or topic" />
      <p className="text-xs text-muted-foreground">Matches use title, keywords and available list content. Related wording is not proof of a duplicate. Different projects may share valid lessons.</p>
      {query.isFetching && <p role="status" className="text-sm">Loading library passages…</p>}
      {query.error && <div role="alert" className="text-sm text-red-800">Could not load library content. <Button type="button" size="sm" variant="ghost" onClick={() => void query.refetch()}>Retry</Button></div>}
      {query.isSuccess && !matches.length && <p className="text-sm text-muted-foreground">{search.trim() ? 'No matching passages in the available list content. Try different terms; this does not establish that no related lesson exists.' : 'Enter a topic to compare.'}</p>}
      {matches.map(({ item, matches: passages }) => <article key={item.id} className="space-y-2 rounded border bg-white p-3 text-sm">
        <a href={item.pdf.link} target="_blank" rel="noreferrer" className="font-semibold underline">{item.title}</a>
        {passages.filter((passage) => !['title', 'keywords'].includes(passage.field)).slice(0, 2).map((passage) => <blockquote key={passage.field} className="border-l-2 pl-3"><strong className="text-xs">{labels[passage.field]}</strong><p className="mt-1">{evidenceExcerpt(passage.text, passage.matched)}</p></blockquote>)}
        {passages.every((passage) => ['title', 'keywords'].includes(passage.field)) && <p className="text-xs text-muted-foreground">Match in title or keywords. Open the source to confirm relevance.</p>}
        <details><summary className="cursor-pointer text-xs">Read available source content</summary>{(['situation', 'rootCause', 'impact', 'recommendation'] as const).map((field) => item[field] && <div key={field} className="mt-2"><strong>{labels[field]}</strong><p className="whitespace-pre-wrap break-words">{item[field]}</p></div>)}</details>
        <label className="flex items-center gap-2"><input type="checkbox" checked={selected.some((source) => source.id === item.id)} disabled={selected.length >= 3 && !selected.some((source) => source.id === item.id)} onChange={(event) => onSelect(event.target.checked ? [...selected, item] : selected.filter((source) => source.id !== item.id))} />Use as a reference for AI revisions</label>
      </article>)}
    </>}
  </section>;
}
