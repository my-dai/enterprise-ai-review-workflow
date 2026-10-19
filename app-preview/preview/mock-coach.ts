// Only the local-review Vite config uses this module. No connector or AI calls.
import { parseKeywords, requireAgentContent } from '../src/lib/ai-feedback-state';
export { parseKeywords };
export type FeedbackField = 'situation' | 'rootCause' | 'impact' | 'recommendation';
export interface CoachFlowForm {
  topic: string; customer: string; title: string; discipline: string; csiDivision: string; company: string;
  keywords: string; deliverySystem: string; author: string; project: string; situation: string; rootCause: string;
  impact: string; recommendation: string; level1Manager: string; revisionNote: string; attachments: File[];
}
async function simulatedReply(kind: 'feedback' | 'keywords', signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise((resolve) => setTimeout(resolve, 900));
  signal?.throwIfAborted();
  const mode = document.querySelector<HTMLSelectElement>('#response-mode')?.value;
  if (mode === 'error') return requireAgentContent('This agent is currently unavailable. Please try again later.');
  return kind === 'feedback'
    ? 'Identify why the coordination check was missed, who owns the next review, and when clearance must be confirmed. Keep the cause separate from the corrective action.'
    : 'BIM coordination, ductwork clearance, installation sequence, pre-installation review';
}
export const askFieldFeedback = (_field: unknown, _label: unknown, _form: unknown, signal?: AbortSignal) => simulatedReply('feedback', signal);
export const generateKeywords = (_form: unknown, signal?: AbortSignal) => simulatedReply('keywords', signal);
export async function askFieldRevision(field: import('../src/lib/field-revision').RevisionField, form: CoachFlowForm, sources: import('../src/lib/library-evidence').LibraryEvidence[], signal?: AbortSignal) {
  await simulatedReply('feedback', signal);
  return {
    field,
    replacement: field === 'recommendation' ? 'Proposed improvement: confirm cable tray and ductwork clearances during the pre-installation review, before ceiling work begins.' : '',
    explanation: field === 'recommendation' ? 'Make the action and timing explicit. Confirm that this timing fits your project.' : 'The draft identifies a missing review but does not explain why the electrical lead was not included.',
    questions: field === 'recommendation' ? ['Who will own this check?'] : ['Was the electrical lead absent from the review invitation, or was the review skipped?'],
    sourceIds: field === 'recommendation' ? sources.map((source) => source.id) : [],
  };
}
