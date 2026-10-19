import type { IOperationResult } from '@microsoft/power-apps/data';
import { LessonLearnedPDFService } from '@/generated/services/LessonLearnedPDFService';
import { LessonLearnedService } from '@/generated/services/LessonLearnedService';
import type { LibraryEvidence } from './library-evidence';

// Published lessons from the LessonsLearned site: the "Lesson Learned" list and the "Lesson Learned PDF" library.
// A PDF belongs to a lesson when its LessonLearnedLinkID equals the lesson's ID (which also equals its SPRowID).
// Only lessons that have a PDF are included.
export type LibraryLesson = LibraryEvidence;

function plainText(value?: string): string {
  if (!value) return '';
  // SharePoint rich text is read as text only; never inject its HTML into the app.
  const doc = new DOMParser().parseFromString(value, 'text/html');
  doc.querySelectorAll('script,style').forEach((node) => node.remove());
  doc.querySelectorAll('br,p,div,li').forEach((node) => node.append(' '));
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function unwrap<T>(result: IOperationResult<T>, what: string): T {
  if (!result.success) throw result.error ?? new Error(`Could not load ${what}.`);
  return result.data;
}

// Reads every row by asking for IDs above the last one seen, so it works whatever page size SharePoint returns.
async function loadAll<T extends { ID?: number }>(load: (options: { filter: string; orderBy: string[]; top: number }) => Promise<IOperationResult<T[]>>, what: string): Promise<T[]> {
  const rows: T[] = [];
  let lastId = 0;
  for (let page = 0; page < 200; page += 1) {
    const batch = unwrap(await load({ filter: `ID gt ${lastId}`, orderBy: ['ID asc'], top: 1000 }), what) ?? [];
    const ids = batch.map((row) => row.ID ?? 0);
    if (!batch.length || Math.max(...ids) <= lastId) break;
    rows.push(...batch);
    lastId = Math.max(...ids);
  }
  return rows;
}

export async function loadLibraryLessons(): Promise<LibraryLesson[]> {
  const [items, pdfs] = await Promise.all([
    loadAll((options) => LessonLearnedService.getAll(options), 'the Lesson Learned list'),
    loadAll((options) => LessonLearnedPDFService.getAll(options), 'the Lesson Learned PDF library'),
  ]);
  const pdfByLessonId = new Map<number, { name: string; link: string }>();
  for (const file of pdfs) {
    const link = file['{Link}'];
    if (file.LessonLearnedLinkID == null || !link) continue;
    pdfByLessonId.set(file.LessonLearnedLinkID, { name: file['{FilenameWithExtension}'] ?? file.Title ?? 'Lesson PDF', link });
  }
  const lessons: LibraryLesson[] = [];
  for (const item of items) {
    const pdf = item.ID != null ? pdfByLessonId.get(item.ID) : undefined;
    if (pdf) lessons.push({
      id: item.ID!, title: item.Title?.trim() || '(Untitled)', pdf,
      situation: plainText(item.Description_x002f_Background),
      rootCause: plainText(item.Root_x0020_Cause), impact: plainText(item.Impacts),
      recommendation: plainText(item.Lessons_x0020_Learned_x002c__x00),
      keywords: plainText(item.Keyword), discipline: item.Discipline?.Value ?? '',
    });
  }
  return lessons.sort((a, b) => b.id - a.id);
}
