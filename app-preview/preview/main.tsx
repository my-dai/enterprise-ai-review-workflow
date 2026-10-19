import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { FeedbackTextarea } from '../src/components/feedback-textarea';
import { KeywordSuggestions } from '../src/components/keyword-suggestions';
import { mergeKeywords } from '../src/lib/ai-feedback-state';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LibraryReferences } from '../src/components/library-references';
import type { LibraryEvidence } from '../src/lib/library-evidence';
const queryClient = new QueryClient();

function Preview() {
  const [references, setReferences] = useState<LibraryEvidence[]>([]);
  const [title, setTitle] = useState('Coordinate cable tray clearances before installation');
  const [rootCause, setRootCause] = useState('The coordination review did not include the electrical lead before ceiling installation.');
  const [recommendation, setRecommendation] = useState('Confirm cable tray and ductwork clearances at the pre-installation review.');
  const [keywords, setKeywords] = useState('coordination');
  const form = { title, situation: 'Cable tray conflicted with ductwork above the ceiling.', rootCause, impact: 'The installation required rework.', recommendation, topic: '', customer: '', discipline: '', csiDivision: '', company: '', keywords, deliverySystem: '', author: '', project: '', level1Manager: '', revisionNote: '', attachments: [] };
  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#1d2225] text-white"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5"><strong className="text-xl">Lessons Learned</strong><span className="rounded border border-slate-500 px-3 py-1 text-xs">Local interaction preview · simulated AI</span></div></header>
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div><p className="text-sm text-slate-500">FORM REVIEW</p><h1 className="mt-1 text-3xl font-bold">Keep AI feedback in sync with your lesson</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Use the actual form components below. Request feedback, edit the lesson, and review keyword suggestions before adding them. No information is sent to Power Apps, SharePoint, or an AI service.</p></div>
      <section className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-bold">Lesson details</h2><label htmlFor="preview-title" className="text-sm font-semibold">Title</label><input id="preview-title" className="mt-2 w-full rounded-md border px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} /></section>
      <section className="space-y-6 rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Descriptions</h2>
        <LibraryReferences initialQuery={title} selected={references} onSelect={setReferences} />
        <FeedbackTextarea field="rootCause" label="Root Cause" required value={rootCause} onChange={setRootCause} form={form} sources={references} />
        <FeedbackTextarea field="recommendation" label="Lessons Learned / Corrective Action" required value={recommendation} onChange={setRecommendation} form={form} sources={references} />
      </section>
      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Keywords</h2><label className="block text-sm" htmlFor="preview-keywords">Your keywords</label><input id="preview-keywords" className="w-full rounded-md border px-3 py-2 text-sm" value={keywords} onChange={(event) => setKeywords(event.target.value)} /><KeywordSuggestions form={form} onAccept={(suggestions) => setKeywords((current) => mergeKeywords(current, suggestions))} /></section>
      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-slate-400 p-4 text-sm"><div><strong>Test a service failure</strong><p className="mt-1 text-slate-600">Your writing stays unchanged when suggestions are unavailable.</p></div><select id="response-mode" aria-label="Simulated AI response" className="rounded border bg-white p-2"><option value="success">Successful response</option><option value="error">Agent unavailable</option></select></aside>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Preview /></QueryClientProvider>);
