import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { askFieldFeedback, type CoachFlowForm, type FeedbackField } from '@/lib/lesson-coach-api';
import { lessonTextVersion, requireAgentContent } from '@/lib/ai-feedback-state';
import { FieldRevision } from './field-revision';
import type { LibraryEvidence } from '@/lib/library-evidence';

// A description box with an optional "Get feedback" button. Feedback appears in a panel under the box only after
// the author asks for it; the panel's tab minimizes and reopens it. The text is plain and selectable for copying.
export function FeedbackTextarea({ field, label, required, value, onChange, placeholder, form, sources }: {
  field: FeedbackField; label: string; required?: boolean; value: string; onChange: (value: string) => void;
  placeholder?: string; form: CoachFlowForm; sources?: LibraryEvidence[];
}) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text: string; version?: string }>({ status: 'idle', text: '' });
  const [minimized, setMinimized] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const version = lessonTextVersion(form);
  const stale = state.status === 'done' && state.version !== version;
  const stop = () => { request.current?.abort(); setState({ status: 'idle', text: '' }); };

  const getFeedback = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setMinimized(false);
    setState({ status: 'loading', text: '', version });
    try {
      const text = await askFieldFeedback(field, label, form, controller.signal);
      if (!controller.signal.aborted) setState({ status: 'done', text: requireAgentContent(text), version });
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', text: error instanceof Error ? error.message : 'Could not get feedback.' });
    }
  };

  const panelId = `${field}-feedback`;
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-2">
      <Label htmlFor={field}>{label}{required ? ' *' : ''}</Label>
      <div className="flex items-center gap-2">{state.status === 'loading' && <Button type="button" size="sm" variant="ghost" onClick={stop}>Stop waiting</Button>}<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" disabled={state.status === 'loading' || !value.trim()} title={value.trim() ? undefined : 'Write something first'} onClick={() => void getFeedback()}>{state.status === 'loading' ? 'Getting feedback…' : state.status === 'idle' ? 'Get feedback' : 'Get new feedback'}</Button></div>
    </div>
    <Textarea id={field} className="mt-2" rows={4} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    <FieldRevision field={field} form={form} sources={sources} onChange={onChange} />
    {state.status !== 'idle' && <div className="mt-2 overflow-hidden rounded-md border bg-slate-50">
      {stale && <p role="status" className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Your lesson has changed. This feedback is based on an earlier version. Get new feedback before using it.</p>}
      <button type="button" aria-expanded={!minimized} aria-controls={panelId} onClick={() => setMinimized((value) => !value)} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100">
        Feedback on {label.toLowerCase().startsWith('lessons learned') ? 'the lesson learned' : label}{minimized ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>
      {!minimized && <div id={panelId} className="border-t px-3 py-2 text-sm leading-6">
        {state.status === 'loading' && <p className="text-muted-foreground">Reading this section…</p>}
        {state.status === 'error' && <p role="alert" className="text-red-800">{state.text}</p>}
        {state.status === 'done' && <p className="whitespace-pre-wrap select-text">{state.text}</p>}
      </div>}
    </div>}
  </div>;
}
