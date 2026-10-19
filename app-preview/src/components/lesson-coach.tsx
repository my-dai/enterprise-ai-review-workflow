import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUp, Bot, Maximize2, MessageCircle, Minimize2, RefreshCw, Send, Square, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Skeleton } from '@/components/ui/skeleton';
import { askCoach, askCoachFlow, askCopilotAgent, coachProviders, type CoachFlowForm, type CoachProvider, type CoachRequest } from '@/lib/lesson-coach-api';
import { loadLibraryLessons } from '@/lib/lessons-library';

interface LessonCoachProps {
  // Field label → current value, sent to the coach as the lesson form.
  lesson: Record<string, string>;
  // The same form as named fields, for the custom Copilot agent's Power Automate flow.
  form: CoachFlowForm;
}

interface CoachMessage {
  id: string;
  role: 'coach' | 'user';
  text: string;
}

const historyKey = 'lesson-coach-history-v2';
const providerKey = 'lesson-coach-provider';
const initialMessage: CoachMessage = {
  id: 'welcome',
  role: 'coach',
  text: 'Ask a construction question, find company guidance, or ask me to review your lesson form. SharePoint answers require a connected agent with access to your documents.',
};

function loadProvider(): CoachProvider {
  try {
    const saved = window.localStorage.getItem(providerKey);
    return saved === 'openai' || saved === 'flow' ? saved : 'copilot';
  } catch {
    return 'copilot';
  }
}

function loadHistory(): CoachMessage[] {
  try {
    const saved = window.sessionStorage.getItem(historyKey);
    return saved ? JSON.parse(saved) as CoachMessage[] : [initialMessage];
  } catch {
    return [initialMessage];
  }
}

// Put a blank line before each ALL-CAPS section header (e.g. "STILL MISSING:", "TOP FIXES:") so reviews aren't one dense block.
function spaceSections(text: string): string {
  return text
    .replace(/\n+(?=[A-Z][A-Z &/-]{2,}:)/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

interface CitedLesson { title?: string; link: string }

const pdfName = (url: string): string => {
  try { return decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() ?? '').toLowerCase(); } catch { return ''; }
};
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Coach replies cite lessons as "(Source: LL_1711_11142025.pdf)", footnote markers like "[1]", and/or reference lines like
// `[1]: https://…/LL_1711_11142025.pdf "LL_1711_11142025.pdf"`. Hide those and make the lesson's title the link instead:
// if the title already appears in the reply it becomes the link; otherwise the title replaces the "(Source: …)" text.
// Files not found in the Lesson Learned PDF library (and with no reference URL) are left as written.
function linkLessonTitles(text: string, library: Map<string, CitedLesson>): ReactNode[] {
  const lessons = new Map(library);
  const refs = new Map<string, string>();
  let body = text.replace(/^[ \t]*\[(\d+)\]:[ \t]*(https?:\/\/\S+).*$/gm, (_line: string, ref: string, url: string) => {
    refs.set(ref, url);
    const name = pdfName(url);
    if (name && !lessons.has(name)) lessons.set(name, { link: url });
    return '';
  });

  const titled: CitedLesson[] = [];
  const inline: CitedLesson[] = [];
  body = body.replace(/[ \t]*\((?:sources?)\s*:?\s*([^)]*)\)/gi, (whole: string, inner: string) => {
    const names = [
      ...[...inner.matchAll(/[\w.-]+\.pdf/gi)].map((match) => match[0].toLowerCase()),
      ...[...inner.matchAll(/\[(\d+)\]/g)].map((match) => pdfName(refs.get(match[1]) ?? '')),
    ];
    const cited = [...new Set(names)].map((name) => lessons.get(name)).filter((lesson): lesson is CitedLesson => Boolean(lesson));
    if (!cited.length) return whole;
    const placeholders = cited.flatMap((lesson) => {
      if (lesson.title && text.toLowerCase().includes(lesson.title.toLowerCase())) { titled.push(lesson); return []; }
      inline.push(lesson);
      return [`\u0001${inline.length - 1}\u0001`];
    });
    return placeholders.length ? ` (${placeholders.join(', ')})` : '';
  });

  // Footnote markers like "…before scaffold erection.[1]": drop the marker and link the lesson's title on that line
  // (the library title if it appears, otherwise the text before the " — " dash), or add the title as a link at the end.
  body = body.split('\n').map((line: string) => {
    const cited = [...line.matchAll(/\[(\d+)\](?!:)/g)]
      .map((match) => refs.get(match[1]))
      .filter((url): url is string => Boolean(url))
      .map((url) => lessons.get(pdfName(url)) ?? { link: url });
    if (!cited.length) return line;
    const out = line.replace(/\s*\[(\d+)\](?!:)/g, (marker: string, ref: string) => (refs.has(ref) ? '' : marker));
    const extra: string[] = [];
    for (const lesson of cited) {
      if (lesson.title && out.toLowerCase().includes(lesson.title.toLowerCase())) { titled.push(lesson); continue; }
      const lead = out.match(/^\s*(?:[-*•]|\d+\.)?\s*(.+?)\s+[—–]\s+/);
      if (lead) { titled.push({ title: lead[1], link: lesson.link }); continue; }
      inline.push(lesson);
      extra.push(`\u0001${inline.length - 1}\u0001`);
    }
    return extra.length ? `${out} (${extra.join(', ')})` : out;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const link = (lesson: CitedLesson, label: string, key: number) =>
    <a key={key} href={lesson.link} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">{label}</a>;
  const titles = [...new Set(titled.map((lesson) => lesson.title!))];
  const pattern = new RegExp(`(\u0001\\d+\u0001${titles.map((title) => `|${escapeRegExp(title)}`).join('')})`, 'gi');
  const linkedTitles = new Set<string>();
  return body.split(pattern).map((part: string, index: number) => {
    if (index % 2 === 0) return part;
    const slot = part.match(/^\u0001(\d+)\u0001$/);
    if (slot) { const lesson = inline[Number(slot[1])]; return link(lesson, lesson.title ?? pdfName(lesson.link), index); }
    const lesson = titled.find((item) => item.title!.toLowerCase() === part.toLowerCase());
    if (!lesson || linkedTitles.has(part.toLowerCase())) return part;
    linkedTitles.add(part.toLowerCase());
    return link(lesson, part, index);
  });
}

export function LessonCoach({ lesson, form }: LessonCoachProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<CoachMessage[]>(loadHistory);
  const historyEndRef = useRef<HTMLDivElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const hasUserMessage = messages.some((message: CoachMessage) => message.role === 'user');
  // Scroll to the top of the user's most recent message, e.g. to reread a question above a long reply.
  const jumpToLastQuestion = () => {
    const sent = logRef.current?.querySelectorAll<HTMLElement>('[data-role="user"]');
    sent?.[sent.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [provider, setProvider] = useState<CoachProvider>(loadProvider);
  const conversationId = useRef<string | undefined>(undefined);
  const lastRequest = useRef<{ request: CoachRequest; provider: CoachProvider; form: CoachFlowForm } | null>(null);
  // Same query (and cache) as the Lessons library page; only loaded once the coach is opened.
  const library = useQuery({ queryKey: ['lessons-library'], queryFn: loadLibraryLessons, staleTime: 10 * 60 * 1000, enabled: open });
  const citedLessons = useMemo(() => new Map((library.data ?? []).map((item) => [item.pdf.name.toLowerCase(), { title: item.title, link: item.pdf.link }] as [string, CitedLesson])), [library.data]);
  const abortRef = useRef<AbortController | null>(null);
  const coach = useMutation({
    mutationFn: ({ request, provider: engine, form: fields }: { request: CoachRequest; provider: CoachProvider; form: CoachFlowForm }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      return engine === 'copilot' ? askCopilotAgent(request, conversationId.current, signal)
        : engine === 'flow' ? askCoachFlow(request.messages.at(-1)?.text ?? '', fields, request.messages, signal).then((reply: string) => ({ reply, conversationId: undefined }))
          : askCoach(request, signal).then((reply: string) => ({ reply, conversationId: undefined }));
    },
    onSuccess: ({ reply, conversationId: nextId }: { reply: string; conversationId?: string }) => {
      if (nextId) conversationId.current = nextId;
      setMessages((current: CoachMessage[]) => [...current, { id: `coach-${Date.now()}`, role: 'coach', text: reply }]);
    },
  });
  const changeProvider = (next: CoachProvider) => {
    setProvider(next);
    conversationId.current = undefined;
    coach.reset();
    try {
      window.localStorage.setItem(providerKey, next);
    } catch {
      // Storage may be unavailable; the choice still applies for this session.
    }
  };
  const isFetching = coach.isPending;
  // Stop waiting for the current reply: cancel the request and leave a note in the conversation.
  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    coach.reset();
    setMessages((current: CoachMessage[]) => [...current, { id: `stopped-${Date.now()}`, role: 'coach', text: 'Stopped.' }]);
  };


  useEffect(() => {
    window.sessionStorage.setItem(historyKey, JSON.stringify(messages));
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isFetching]);

  // Opening the coach or switching full screen on/off resizes the panel; jump straight back to the latest message.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => historyEndRef.current?.scrollIntoView({ block: 'end' }));
    return () => window.cancelAnimationFrame(frame);
  }, [open, expanded]);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isFetching || !input.trim()) return;
    const question = input.trim();
    const userMessage: CoachMessage = { id: `user-${Date.now()}`, role: 'user', text: question };
    const history = [...messages, userMessage].filter((message: CoachMessage) => message.id !== initialMessage.id && !message.id.startsWith('stopped-'));
    setMessages((current: CoachMessage[]) => [...current, userMessage]);
    setInput('');
    lastRequest.current = {
      request: { lesson, messages: history.slice(-10).map(({ role, text }: CoachMessage) => ({ role, text })) },
      provider,
      form,
    };
    coach.mutate(lastRequest.current);
  };

  return (
    <div className={open && expanded ? 'fixed inset-4 z-50 flex flex-col' : 'fixed bottom-6 right-6 z-50'}>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className={expanded ? 'mb-3 min-h-0 flex-1' : 'mb-3'}>
            <Card className={expanded ? 'h-full w-full overflow-hidden shadow-xl' : 'h-[520px] w-[min(390px,calc(100vw-3rem))] overflow-hidden shadow-xl'}>
              <CardHeader className="flex flex-row items-center justify-between border-b bg-primary text-primary-foreground">
                <div><CardTitle className="flex items-center gap-2 text-base"><Bot className="size-5" />Lesson coach</CardTitle><label className="mt-1 flex items-center gap-1 text-xs">Engine<select aria-label="Coach engine" value={provider} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => changeProvider(event.target.value as CoachProvider)} disabled={isFetching} className="rounded border border-primary-foreground/40 bg-primary px-1 py-0.5 text-xs text-primary-foreground">{(Object.keys(coachProviders) as CoachProvider[]).map((key: CoachProvider) => <option key={key} value={key}>{coachProviders[key]}</option>)}</select></label></div>
                <div className="flex gap-1"><Button type="button" size="icon-sm" variant="secondary" disabled={!hasUserMessage} aria-label="Jump to my last message" title="Jump to my last message" onClick={jumpToLastQuestion}><ArrowUp /></Button><Button type="button" size="icon-sm" variant="secondary" disabled={isFetching} aria-label="Clear conversation history" onClick={() => { setMessages([initialMessage]); coach.reset(); conversationId.current = undefined; window.sessionStorage.removeItem(historyKey); }}><Trash2 /></Button><Button type="button" size="icon-sm" variant="secondary" aria-label={expanded ? 'Exit full screen' : 'Full screen'} title={expanded ? 'Exit full screen' : 'Full screen'} onClick={() => setExpanded((current: boolean) => !current)}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button><Button type="button" size="icon-sm" variant="secondary" aria-label="Close coach" onClick={() => setOpen(false)}><X /></Button></div>
              </CardHeader>
              <CardContent className={expanded ? 'flex min-h-0 flex-1 flex-col p-0' : 'flex h-[440px] min-h-0 flex-col p-0'}>
                <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" role="log" aria-label="Coach conversation" aria-live="polite">
                  <div className={expanded ? 'mx-auto grid w-full max-w-3xl grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3'}>
                    {messages.map((message: CoachMessage) => <div key={message.id} data-role={message.role} className={message.role === 'coach' ? 'min-w-0 rounded-lg bg-muted p-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere]' : 'ml-8 min-w-0 rounded-lg bg-primary p-3 text-sm text-primary-foreground whitespace-pre-wrap [overflow-wrap:anywhere]'}>{message.role === 'coach' ? linkLessonTitles(spaceSections(message.text), citedLessons) : message.text}</div>)}
                    {isFetching && <div className="grid gap-2 rounded-lg bg-muted p-3" aria-live="polite"><Skeleton className="h-3 w-full animate-pulse" aria-hidden="true" /><Skeleton className="h-3 w-4/5 animate-pulse" aria-hidden="true" /></div>}
                    {coach.isError && <div className="rounded-lg border p-3 text-sm"><p className="font-medium">The coach could not respond.</p><p className="mt-1 text-muted-foreground">{coach.error instanceof Error ? coach.error.message : 'Check your connection and try again.'}</p><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => { if (lastRequest.current) coach.mutate(lastRequest.current); }}><RefreshCw />Try again</Button></div>}
                    <div ref={historyEndRef} />
                  </div>
                </div>
                <form className="flex shrink-0 gap-2 border-t bg-card p-3 text-card-foreground" onSubmit={send}><Input value={input} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setInput(event.target.value)} placeholder="Ask a question or request a review…" disabled={isFetching} />{isFetching ? <Button type="button" size="icon" variant="outline" aria-label="Stop response" title="Stop" onClick={stop}><Square /></Button> : <Button type="submit" size="icon" aria-label="Send to coach"><Send /></Button>}</form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <Button type="button" size="lg" className="ml-auto rounded-full shadow-lg" onClick={() => setOpen((current: boolean) => !current)}><MessageCircle />{open ? 'Hide coach' : 'Coach me'}</Button>
    </div>
  );
}
