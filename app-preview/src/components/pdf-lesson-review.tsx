import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Download, Highlighter, Loader2, MessageSquare, Minus, Plus, Pencil, X, Trash2 } from 'lucide-react';
import { getDocument, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { commentField, effectiveCommentState, reviewContentVersion } from '@/lib/review-followup';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { enableSmoothSelection } from '@/lib/pdf-text-selection';
import { createLessonReviewPdf, projectPdfComments, reviewDocumentKey, type PdfEditRegion } from '@/lib/lesson-review-pdf';
import { selectedPdfRects } from '@/lib/pdf-selection';
import { useWorkflow, type LessonRecord, type PdfEditableField, type PdfHighlightRect, type PdfReviewComment } from '@/lib/workflow-data';
import './pdf-lesson-review.css';

// Power Apps can't serve pdf.js's worker as a separate file, so the worker is bundled and runs on the main thread.
(globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
type SelectionDraft = { quote: string; rects: PdfHighlightRect[]; field?: PdfEditableField };
type PdfEditing = { onChange: (field: PdfEditableField, value: string) => void; onPendingChange?: (pending: boolean) => void };

function PdfPage({ document, documentKey, pageNumber, width, comments, activeId, draft, onActivate, regions, editing, onEdit, editor, onWriteComment, onCancelSelection }: {
  document: PDFDocumentProxy; documentKey: string; pageNumber: number; width: number; comments: PdfReviewComment[];
  activeId: string | null; draft: SelectionDraft | null; onActivate: (id: string) => void;
  regions: PdfEditRegion[]; editing?: PdfEditing; onEdit: (region: PdfEditRegion) => void; editor?: ReactNode;
  onWriteComment: () => void; onCancelSelection: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height: width * 1.414 });
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textLayer: TextLayer | undefined;
    let stopSmoothSelection: (() => void) | undefined;
    const render = async () => {
      const page = await document.getPage(pageNumber);
      if (cancelled || !canvasRef.current || !textRef.current) return;
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      setDimensions({ width: viewport.width, height: viewport.height });
      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      const container = textRef.current;
      container.replaceChildren();
      container.style.setProperty('--total-scale-factor', String(viewport.scale));
      renderTask = page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      textLayer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (!cancelled) stopSmoothSelection = enableSmoothSelection(container);
    };
    setError('');
    void render().catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not render page.'); });
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); stopSmoothSelection?.(); };
  }, [document, pageNumber, width]);
  const position = (rect: PdfHighlightRect): CSSProperties => ({ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` });
  const pins = comments.map((comment, index) => ({ comment, index, first: comment.rects[0] })).filter(({ comment, first }) => first?.page === pageNumber && comment.documentKey === documentKey).sort((a, b) => a.first.y - b.first.y);
  let lastPin = 0;
  const placedPins = pins.map((pin) => {
    const top = Math.max(pin.first.y + Math.min(pin.first.height / 2, 10 / dimensions.height), lastPin + 28 / dimensions.height);
    lastPin = top;
    return { ...pin, top };
  });
  const pinOverflow = Math.max(0, lastPin - 0.97);
  const selectionEnd = draft?.rects.filter((rect) => rect.page === pageNumber).at(-1);
  return <div className="review-pdf-page" data-page={pageNumber} style={dimensions}>
    <canvas ref={canvasRef} aria-label={`Lesson review document, page ${pageNumber}`} />
    <div ref={textRef} className="review-pdf-text" data-pdf-text-layer />
    <div className="review-pdf-highlights">
      {comments.filter((comment) => comment.documentKey === documentKey).map((comment) => comment.rects.filter((rect) => rect.page === pageNumber).map((rect, index) => <span key={`${comment.id}-${index}`} data-highlight={comment.id} className={`review-pdf-highlight ${comment.anchorKind === 'section' ? 'is-section' : ''} ${activeId === comment.id ? 'is-active' : ''}`} style={position(rect)} />))}
      {draft?.rects.filter((rect) => rect.page === pageNumber).map((rect, index) => <span key={`draft-${index}`} className="review-pdf-highlight is-draft" style={position(rect)} />)}
    </div>
    {editing && [...new Set(regions.filter((region) => region.page === pageNumber).map((region) => region.field))].map((field) => {
      const lines = regions.filter((region) => region.page === pageNumber && region.field === field);
      const first = lines[0], last = lines[lines.length - 1];
      return <button key={field} type="button" className="review-pdf-edit-target" style={position({ ...first, height: last.y + last.height - first.y })} aria-label={`Edit ${first.label} in PDF`} onClick={() => onEdit(first)}><span><Pencil className="size-3" />Edit</span></button>;
    })}
    {placedPins.map(({ comment, index, top }) => <button key={comment.id} type="button" className={`review-pdf-pin ${activeId === comment.id ? 'is-active' : ''}`} style={{ left: '96%', top: `${(top - pinOverflow) * 100}%` }} aria-label={`Open comment ${index + 1}: ${comment.text}`} onClick={() => onActivate(comment.id)}>{index + 1}</button>)}
    {selectionEnd && <div className="review-pdf-selection-toolbar" style={{ left: `${Math.max(20, Math.min(80, (selectionEnd.x + selectionEnd.width / 2) * 100))}%`, top: `${(selectionEnd.y + selectionEnd.height) * 100}%` }}>
      <button type="button" onClick={onWriteComment}><MessageSquare className="size-3.5" />Comment</button><button type="button" aria-label="Cancel selection" onClick={onCancelSelection}><X className="size-3.5" /></button>
    </div>}
    {editor}
    {error && <p role="alert" className="absolute inset-x-0 top-0 bg-red-50 p-4 text-sm text-red-800">Could not render page: {error}</p>}
  </div>;
}

function CommentReply({ lessonId, comment, canReply }: { lessonId: string; comment: PdfReviewComment; canReply: boolean }) {
  const { replyToPdfComment, nameOf } = useWorkflow();
  const [reply, setReply] = useState('');
  return <>
    {comment.replies.map((entry) => <div key={entry.id} className="mt-3 border-l-2 pl-3 text-sm"><p className="font-semibold">{nameOf(entry.actor)}</p><p className="whitespace-pre-wrap break-words">{entry.text}</p></div>)}
    {canReply && <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); if (!reply.trim()) return; void replyToPdfComment(lessonId, comment.id, reply).then((saved) => { if (saved) setReply(''); }); }}>
      <Textarea aria-label={`Reply to ${nameOf(comment.actor)}'s comment`} placeholder="Write a reply…" rows={2} value={reply} onChange={(event) => setReply(event.target.value)} />
      <Button type="submit" size="sm" variant="outline" disabled={!reply.trim()}>Reply</Button>
    </form>}
  </>;
}

export function PdfLessonReview({ lesson: source, canAnnotate, canReply, renderSidebar, attachments, editing }: {
  lesson: LessonRecord; canAnnotate: boolean; canReply: boolean;
  renderSidebar: (commentPanel: ReactNode, hasDraft: boolean) => ReactNode; attachments?: ReactNode;
  editing?: PdfEditing;
}) {
  const { addPdfComment, deletePdfComment, setPdfCommentState, actor, role, nameOf, lessons } = useWorkflow();
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const persisted = lessons.find((item) => item.id === source.id);
  const hasUnsavedContent = Boolean(persisted && reviewContentVersion(persisted) !== reviewContentVersion(source));
  // People are stored by email; the PDF shows the author's name.
  const lesson = { ...source, submittedBy: nameOf(source.author || source.submittedBy) };
  const documentKey = reviewDocumentKey(lesson);
  // Re-render PDF only when its content changes, not when a comment/reply is saved.
  const { pdfBytes, regions } = useMemo(() => {
    const regions: PdfEditRegion[] = [];
    const pdfBytes = new Uint8Array(createLessonReviewPdf(lesson, undefined, regions).output('arraybuffer'));
    return { pdfBytes, regions };
  }, [documentKey]);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(560);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SelectionDraft | null>(null);
  // Selecting text only shows the floating Comment button; the comment box opens when the reviewer clicks it.
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [editRegion, setEditRegion] = useState<PdfEditRegion | null>(null);
  const [editText, setEditText] = useState('');
  const inlineEditRef = useRef<HTMLTextAreaElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const originalComments = lesson.pdfComments ?? [];
  const comments = projectPdfComments(lesson, regions);
  useEffect(() => { editing?.onPendingChange?.(Boolean(editRegion)); }, [Boolean(editRegion), editing?.onPendingChange]);
  useEffect(() => { if (editRegion) { inlineEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); inlineEditRef.current?.focus({ preventScroll: true }); } }, [editRegion]);

  useEffect(() => {
    const task = getDocument({ data: pdfBytes.slice() });
    let cancelled = false;
    setDocument(null); setLoadError(''); setDraft(null); setText(''); setActiveId(null);
    void task.promise.then((doc) => { if (!cancelled) setDocument(doc); }).catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load PDF.'); });
    return () => { cancelled = true; void task.destroy(); };
  }, [pdfBytes]);
  useEffect(() => {
    if (!viewerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setFitWidth(Math.max(200, entry.contentRect.width - 40)));
    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setDraft(null); setText(''); }, [canAnnotate]);

  const focusComposer = () => { composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); composerRef.current?.focus({ preventScroll: true }); };
  useEffect(() => { if (!draft) setComposing(false); }, [draft]);
  useEffect(() => { if (composing) focusComposer(); }, [composing]);
  const selectText = (event?: { clientX: number; clientY: number; target: EventTarget | null }) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) {
      if (event?.target instanceof Element && event.target.closest('[data-pdf-text-layer]')) {
        const page = event.target.closest<HTMLElement>('[data-page]');
        if (page) {
          const bounds = page.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width, y = (event.clientY - bounds.top) / bounds.height;
          const hit = comments.find((comment) => comment.documentKey === documentKey && comment.rects.some((rect) => rect.page === Number(page.dataset.page) && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height));
          if (hit) openComment(hit.id);
        }
      }
      return;
    }
    if (!canAnnotate) return;
    const range = selection.getRangeAt(0);
    const getLayer = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-pdf-text-layer]');
    const startLayer = getLayer(range.startContainer);
    const endLayer = getLayer(range.endContainer);
    if (!startLayer || !endLayer || !viewerRef.current?.contains(startLayer)) return;
    if (startLayer !== endLayer) { toast.info('Select a passage on one page at a time.'); return; }
    const page = startLayer.closest<HTMLElement>('[data-page]')!;
    if (draft && text.trim()) { toast.info('Save or cancel your current comment before selecting another passage.'); selection.removeAllRanges(); return; }
    const rects = selectedPdfRects(range, startLayer, page);
    if (!rects.length) return;
    const fields = [...new Set(regions.filter((region) => rects.some((rect) => rect.page === region.page && rect.y < region.y + region.height && rect.y + rect.height > region.y)).map((region) => region.field))];
    setDraft({ quote: selection.toString().trim(), rects, field: fields.length === 1 ? fields[0] : undefined }); setComposing(false); setText(''); setActiveId(null);
    selection.removeAllRanges();
  };
  const goToComment = (id: string) => {
    setActiveId(id);
    window.getSelection()?.removeAllRanges();
    documentElementForComment(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const documentElementForComment = (id: string) => viewerRef.current?.querySelector<HTMLElement>(`[data-highlight="${id}"]`);
  const openComment = (id: string) => {
    setActiveId(id);
    const card = window.document.getElementById(`pdf-comment-${id}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card?.querySelector<HTMLButtonElement>('[data-show-passage]')?.focus({ preventScroll: true });
  };
  const download = () => {
    if (editRegion) { toast.info('Apply or cancel your text edit before downloading.'); return; }
    try { createLessonReviewPdf(lesson, comments.map((comment) => ({ ...comment, actor: nameOf(comment.actor), replies: comment.replies.map((reply) => ({ ...reply, actor: nameOf(reply.actor) })) }))).save(`${(lesson.title || 'lesson').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'lesson'}${comments.length ? '-annotated' : '-review'}.pdf`); }
    catch { toast.error('Could not download the review copy. Please try again.'); }
  };
  const beginEdit = (region: PdfEditRegion) => { if (editRegion) { toast.info('Apply or cancel the current text edit before editing another section.'); return; } setEditRegion(region); setEditText(String(lesson[region.field] ?? '')); };

  const editor = editRegion && editing ? <form className="review-pdf-inline-edit rounded border-2 border-blue-500 bg-white p-3 shadow-xl" style={{ left: `${editRegion!.x * 100}%`, top: `${editRegion!.y * 100}%`, width: `${editRegion!.width * 100}%` }} onSubmit={(event) => { event.preventDefault(); editing!.onChange(editRegion!.field, editText); setEditRegion(null); }}>
          <label htmlFor="pdf-inline-edit" className="text-sm font-semibold">Editing PDF: {editRegion!.label}</label>
          <Textarea ref={inlineEditRef} id="pdf-inline-edit" className="my-3" rows={5} value={editText} onChange={(event) => setEditText(event.target.value)} />
          <div className="flex gap-2"><Button type="submit" size="sm">Apply text edit</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditRegion(null)}>Cancel text edit</Button></div>
        </form> : null;

  const panel = <section aria-label="PDF comments" className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquare className="size-4" />PDF comments <span className="text-sm text-muted-foreground">{comments.length}</span></h2></div>
    <p className="text-xs text-muted-foreground">Comments are visible to the author and reviewers. Select a comment to locate its passage.</p>
    {draft && composing && canAnnotate && <form className="space-y-3 rounded-lg border-2 border-blue-500 bg-blue-50 p-3" onSubmit={(event) => {
      event.preventDefault(); if (!text.trim()) return;
      const { quote, rects, field } = draft;
      void addPdfComment(lesson.id, { quote, rects, field, documentKey, text }).then((saved) => { if (saved) toast.success('Comment added to the highlighted passage.'); });
      setDraft(null); setText('');
    }}>
      <h3 className="text-sm font-semibold">Comment on selected text</h3>
      <blockquote className="max-h-28 overflow-auto border-l-2 border-amber-400 pl-3 text-sm break-words">“{draft.quote}”</blockquote>
      <Textarea ref={composerRef} aria-label="Comment on selected text" rows={4} placeholder="Add your feedback on this passage…" value={text} onChange={(event) => setText(event.target.value)} />
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={!text.trim()}>Add comment</Button><Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(null); setText(''); }}>Cancel</Button></div>
    </form>}
    {!comments.length && !(draft && composing) && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{canAnnotate ? 'Select text in the document to highlight it and add a comment here.' : 'No comments on this document yet.'}</p>}
    <div className="review-pdf-comment-list">{comments.map((comment, index) => {
      const isCurrent = comment.documentKey === documentKey;
      const state = effectiveCommentState(comment, source);
      const field = commentField(comment);
      const changeState = async (next: 'open' | 'author-ready' | 'resolved') => {
        setSavingComment(comment.id);
        try { await setPdfCommentState(source.id, comment.id, next); } finally { setSavingComment(null); }
      };
      return <article key={comment.id} id={`pdf-comment-${comment.id}`} className={`rounded-lg border p-3 transition-colors ${activeId === comment.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'bg-white'}`} onMouseEnter={() => { if (isCurrent) setActiveId(comment.id); }}>
        <div className="flex items-start gap-2"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${activeId === comment.id ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-900'}`}>{index + 1}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{nameOf(comment.actor)} <span className="font-normal text-muted-foreground">· {comment.role}</span></p><time className="text-xs text-muted-foreground" dateTime={comment.at}>{new Date(comment.at).toLocaleString()}</time></div>{canAnnotate && comment.actor === actor && comment.role === role && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-700" aria-label={`Delete comment ${index + 1} and highlight`} onClick={() => { if (activeId === comment.id) setActiveId(null); void deletePdfComment(lesson.id, comment.id).then((saved) => { if (saved) toast.success('Comment and highlight deleted.'); }); }}><Trash2 className="size-3.5" />Delete</Button>}</div>
        <button type="button" data-show-passage className="mt-3 w-full rounded border-l-2 border-amber-400 bg-amber-50 p-2 text-left text-xs break-words hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default" disabled={!isCurrent} onClick={() => goToComment(comment.id)} onFocus={() => { if (isCurrent) setActiveId(comment.id); }} aria-label={`Show highlighted passage for comment ${index + 1}: ${comment.quote}`}>“{comment.quote}”{isCurrent && <span className="mt-1 block font-semibold text-blue-700">Show passage · page {comment.rects[0]?.page}</span>}</button>
        {originalComments[index]?.documentKey !== documentKey && isCurrent && <p className="mt-2 text-xs text-muted-foreground">{comment.anchorKind === 'section' ? 'Revised copy · linked to the section. The quote above is the reviewer’s original selection.' : 'Highlight follows this passage in the revised copy.'}</p>}
        {!isCurrent && <p className="mt-2 text-xs text-amber-800">Earlier document version. The author revised this text; its original highlight is retained with the comment.</p>}
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{comment.text}</p>
        <p className="mt-2 text-xs font-semibold">{state === 'resolved' ? 'Reviewer confirmed resolved' : state === 'author-ready' ? 'Author addressed · awaiting reviewer confirmation' : 'Open feedback'}</p>
        {comment.resolution && comment.resolution.version !== reviewContentVersion(source) && <p className="mt-1 text-xs text-amber-800">Lesson content changed after the previous confirmation.</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {canReply && field && !editRegion && !hasUnsavedContent && <Button asChild size="sm" variant="outline"><Link to={'/new?edit=' + encodeURIComponent(source.id) + '&view=form&field=' + encodeURIComponent(field)}>Go to {field === 'rootCause' ? 'root cause' : field}</Link></Button>}
          {canReply && state === 'open' && <Button type="button" size="sm" variant="outline" disabled={Boolean(savingComment) || hasUnsavedContent || Boolean(editRegion)} onClick={() => void changeState('author-ready')}>Mark addressed</Button>}
          {canAnnotate && state === 'author-ready' && <Button type="button" size="sm" variant="outline" disabled={Boolean(savingComment)} onClick={() => void changeState('resolved')}>Confirm resolved</Button>}
          {((canAnnotate && state !== 'open') || (canReply && state === 'author-ready')) && <Button type="button" size="sm" variant="ghost" disabled={Boolean(savingComment)} onClick={() => void changeState('open')}>Reopen</Button>}
        </div>
        {canReply && hasUnsavedContent && <p className="mt-1 text-xs text-muted-foreground">Save your changes before marking feedback addressed.</p>}
        <CommentReply lessonId={lesson.id} comment={comment} canReply={canReply} />
      </article>;
    })}</div>
  </section>;

  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,.8fr)]">
    <div className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-xl border bg-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 bg-slate-700 px-4 py-3 text-white">
          <span className="mr-auto text-sm font-semibold">Review copy</span>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}><Minus /></Button>
          <button type="button" className="rounded border border-slate-500 px-2 py-1 text-xs" aria-label="Reset zoom to fit width" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.2))}><Plus /></Button>
          {editing && (['rootCause', 'keywords'] as const).filter((field) => !lesson[field]).map((field) => <Button key={field} size="sm" variant="ghost" disabled={!regions.length || Boolean(editRegion)} onClick={() => beginEdit({ ...regions[regions.length - 1], field, label: field === 'rootCause' ? 'Root cause' : 'Keywords' })}>Add {field === 'rootCause' ? 'root cause' : 'keywords'}</Button>)}
          <Button size="sm" variant="ghost" onClick={download}><Download />Download</Button>
        </div>
        {canAnnotate && !editing && <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"><Highlighter className="size-4 shrink-0" />Highlight any text to comment on it.</p>}
        <p className="bg-white px-4 py-2 text-xs text-muted-foreground">{editing ? 'Click a paragraph to edit. Editable areas appear on hover; SME comments stay on the right.' : canAnnotate ? 'Drag across a passage, then click Comment. Click a numbered marker to open its comment.' : 'Click a comment on the right to see its highlighted passage.'} {document && `${document.numPages} ${document.numPages === 1 ? 'page' : 'pages'}`}</p>
        <div ref={viewerRef} className="review-pdf-viewer" onMouseUp={selectText} onKeyUp={(event) => { if (event.key === 'Shift') selectText(); }}>
          {loadError ? <p role="alert" className="bg-white p-6 text-sm text-red-800">Could not load the review document. Use Download to open it in your PDF reader.<br />{loadError}</p> : !document ? <p role="status" className="flex items-center justify-center gap-2 p-12 text-sm"><Loader2 className="size-4 animate-spin" />Loading review document…</p> : Array.from({ length: document.numPages }, (_, index) => <PdfPage key={`${documentKey}-${index}`} document={document} documentKey={documentKey} pageNumber={index + 1} width={fitWidth * zoom} comments={comments} activeId={activeId} draft={draft} onActivate={openComment} regions={regions} editing={editing} editor={editRegion?.page === index + 1 ? editor : null} onEdit={beginEdit} onWriteComment={() => { if (composing) focusComposer(); else setComposing(true); }} onCancelSelection={() => { setDraft(null); setText(''); }} />)}
        </div>

      </div>
      {attachments}
    </div>
    {renderSidebar(panel, Boolean((draft && composing) || editRegion))}
  </div>;
}
