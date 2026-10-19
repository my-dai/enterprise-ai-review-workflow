import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { askFieldRevision, type CoachFlowForm, type FeedbackField } from '@/lib/lesson-coach-api';
import { lessonTextVersion } from '@/lib/ai-feedback-state';
import { sourceContext, type LibraryEvidence } from '@/lib/library-evidence';
import type { FieldRevision as Revision } from '@/lib/field-revision';

export function FieldRevision({ field, form, sources = [], onChange }: {
  field: FeedbackField; form: CoachFlowForm; sources?: LibraryEvidence[]; onChange: (value: string) => void;
}) {
  const [state, setState] = useState<{ busy?: boolean; error?: string; result?: Revision; version?: string; before?: string }>({});
  const [undo, setUndo] = useState<{ before: string; after: string }>();
  const request = useRef<AbortController | null>(null);
  const version = lessonTextVersion(form) + JSON.stringify(sourceContext(sources));
  const currentVersion = useRef(version);
  currentVersion.current = version;
  useEffect(() => () => request.current?.abort(), []);
  const propose = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ busy: true });
    try {
      const result = await askFieldRevision(field, form, sources, controller.signal);
      if (!controller.signal.aborted) setState({ result, version, before: form[field] });
    } catch (error) {
      if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : 'Could not suggest a revision.' });
    }
  };
  const stale = Boolean(state.result && state.version !== version);
  const usedSources = sources.filter((source) => state.result?.sourceIds.includes(source.id));
  return <div className="mt-2 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={state.busy || !form[field].trim()} onClick={() => void propose()}>{state.busy ? 'Preparing suggestion…' : 'Suggest revision'}</Button>
      {state.busy && <Button type="button" size="sm" variant="ghost" onClick={() => { request.current?.abort(); setState({}); }}>Stop waiting</Button>}
      {undo && form[field] === undo.after && <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(undo.before); setUndo(undefined); }}>Undo AI revision</Button>}
    </div>
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}
    {state.result && <section aria-label="Suggested field revision" className="space-y-3 rounded-lg border bg-slate-50 p-4 text-sm">
      {stale && <p role="status" className="font-medium text-amber-900">The lesson or selected references changed. Request a new suggestion before applying.</p>}
      <p>{state.result.explanation}</p>
      {state.result.replacement && <div className="grid gap-3 md:grid-cols-2"><div><h4 className="mb-2 font-semibold">Your wording</h4><p className="whitespace-pre-wrap break-words">{state.before}</p></div><div><h4 className="mb-2 font-semibold">Suggested wording</h4><p className="whitespace-pre-wrap break-words">{state.result.replacement}</p></div></div>}
      {state.result.questions.length > 0 && <div><h4 className="font-semibold">Details to confirm</h4><ul className="mt-2 list-disc space-y-1 pl-5">{state.result.questions.map((question, i) => <li key={i}>{question}</li>)}</ul></div>}
      {usedSources.length > 0 && <div><p className="font-semibold">Referenced lessons</p>{usedSources.map((source) => <a key={source.id} className="mt-1 block underline" href={source.pdf.link} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
      <p className="text-xs text-muted-foreground">Review facts before applying. This updates this field only; save the lesson when ready.</p>
      <div className="flex gap-2">{state.result.replacement && <Button type="button" size="sm" disabled={stale} onClick={() => {
        if (state.version !== currentVersion.current || !state.result?.replacement) return;
        setUndo({ before: form[field], after: state.result.replacement }); onChange(state.result.replacement); setState({});
      }}>Apply to this field</Button>}<Button type="button" size="sm" variant="ghost" onClick={() => setState({})}>Dismiss</Button></div>
    </section>}
  </div>;
}
