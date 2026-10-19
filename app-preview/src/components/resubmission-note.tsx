import { useWorkflow, type LessonRecord } from '@/lib/workflow-data';

// Shown to the reviewer when a lesson comes back after they requested changes:
// their original feedback and the author's reply, quoted like the contributor's "Changes requested" banner.
export function ResubmissionNote({ lesson }: { lesson: LessonRecord }) {
  const { nameOf } = useWorkflow();
  const latest = lesson.history[lesson.history.length - 1];
  if (!latest?.action.startsWith('Revised and resubmitted')) return null;
  const request = [...lesson.history].reverse().find((entry) => entry.action === 'Requested changes');
  if (!request) return null;
  return <div className="rounded-lg border-l-4 border-amber-700 bg-amber-50 p-4">
    <p className="font-semibold">Resubmitted after your feedback</p>
    <p className="mt-1 text-xs text-muted-foreground">{nameOf(lesson.submittedBy)} revised this lesson on {new Date(latest.at).toLocaleDateString()}.</p>
    {request.comment && <><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your feedback · {nameOf(request.actor)}</p><p className="mt-1 text-sm">“{request.comment}”</p></>}
    {latest.comment && <><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Author’s reply</p><p className="mt-1 text-sm">“{latest.comment}”</p></>}
  </div>;
}
