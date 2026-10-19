import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateKeywords, type CoachFlowForm } from '@/lib/lesson-coach-api';
import { lessonTextVersion, parseKeywords, requireAgentContent } from '@/lib/ai-feedback-state';

export function KeywordSuggestions({ form, onAccept }: { form: CoachFlowForm; onAccept: (text: string) => void }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text: string; version?: string }>({ status: 'idle', text: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const version = lessonTextVersion(form);
  const stale = state.status === 'done' && state.version !== version;
  const words = parseKeywords(state.text);
  const canGenerate = [form.title, form.situation, form.rootCause, form.impact, form.recommendation].some((text) => text.trim());
  const generate = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: 'loading', text: '', version });
    setSelected([]);
    try {
      const text = requireAgentContent(await generateKeywords(form, controller.signal));
      if (!controller.signal.aborted) {
        const suggestions = parseKeywords(text);
        if (!suggestions.length) throw new Error('No usable keywords were returned. Your keywords have not changed.');
        setState({ status: 'done', text: suggestions.join(', '), version });
        setSelected(suggestions);
      }
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', text: error instanceof Error ? error.message : 'Could not generate keywords.' });
    }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={state.status === 'loading' || !canGenerate} onClick={() => void generate()}>{state.status === 'loading' ? 'Generating…' : 'Generate keywords'}</Button>
      {state.status === 'loading' && <Button type="button" size="sm" variant="ghost" onClick={() => { request.current?.abort(); setState({ status: 'idle', text: '' }); }}>Stop waiting</Button>}
      <span className="text-xs text-muted-foreground">Suggestions are added only after you accept them.</span>
    </div>
    {state.status === 'error' && <p role="alert" className="text-sm text-red-800">{state.text}</p>}
    {state.status === 'done' && <div className="space-y-3 rounded-md border bg-slate-50 p-4">
      <p className="text-sm font-semibold">Review suggested keywords</p>
      {stale && <p role="status" className="rounded bg-amber-50 p-2 text-sm text-amber-900">Your lesson has changed. Generate new keywords before accepting these suggestions.</p>}
      <div className="flex flex-wrap gap-2">{words.map((word) => <label key={word} className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm">
        <input type="checkbox" checked={selected.includes(word)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, word] : current.filter((value) => value !== word))} />{word}
      </label>)}</div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={stale || !selected.length} onClick={() => { onAccept(selected.join(', ')); setState({ status: 'idle', text: '' }); }}>Add selected keywords</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setState({ status: 'idle', text: '' })}>Dismiss</Button>
      </div>
    </div>}
  </div>;
}
