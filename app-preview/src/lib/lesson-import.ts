import type { LessonRecord } from './workflow-data';
import type { LookupKey } from '@/data/lookups';

export const importColumns = [
  ['title', 'Title', true], ['topic', 'Topic', true], ['discipline', 'Discipline', true],
  ['company', 'Company', true], ['keywords', 'Keywords', true], ['author', 'Author email', true],
  ['situation', 'Description/Background', true], ['rootCause', 'Root Cause', true], ['impact', 'Impacts', true],
  ['recommendation', 'Lessons Learned, Corrective Preventive Action or Improvement Practice', true],
  ['project', 'Job Number', false], ['jobType', 'Job type', false], ['category', 'Category', false],
  ['lesson', 'Lesson learned', false], ['level1Manager', 'Level 1 Manager email', false],
] as const;
export type ImportField = typeof importColumns[number][0];
export type ImportFields = Record<ImportField, string>;
export type ImportRow = { row: number; fields: ImportFields; errors: string[] };
export type ImportLookups = Partial<Record<LookupKey, string[]>>;
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, ImportField> = {
  title: 'title', lessontitle: 'title', topic: 'topic', discipline: 'discipline',
  company: 'company', keywords: 'keywords', author: 'author', authoremail: 'author', rootcause: 'rootCause',
  situation: 'situation', whathappened: 'situation', description: 'situation',
  descriptionbackground: 'situation', impact: 'impact', impacts: 'impact', expectedimpact: 'impact',
  recommendation: 'recommendation', whatshouldchange: 'recommendation', correctiveaction: 'recommendation',
  lessonslearnedcorrectivepreventiveactionorimprovementpractice: 'recommendation',
  project: 'project', jobnumber: 'project', jobtype: 'jobType', category: 'category',
  lesson: 'lesson', lessonlearned: 'lesson', lessonslearned: 'lesson', whatdidwelearn: 'lesson',
  level1manager: 'level1Manager', level1manageremail: 'level1Manager', level1namesubmittermanager: 'level1Manager',
};
const lookupFields: Partial<Record<ImportField, LookupKey>> = {
  topic: 'topic', discipline: 'discipline', company: 'company', author: 'author', level1Manager: 'level1Manager',
};

// A state machine preserves commas, escaped quotes, and line breaks inside quoted CSV cells.
export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (char !== ',') {
        rows.push(row); row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === '"' || (closed && char.trim())) throw new Error('Invalid CSV quoting. Export the spreadsheet as CSV again.');
    else if (!closed) cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted cell. Export the spreadsheet as CSV again.');
  if (cell || row.length || closed) rows.push([...row, cell]);
  return rows;
}

export function validateImport(data: unknown[][], lookups: ImportLookups, lessons: LessonRecord[], submit: boolean): ImportRow[] {
  const headerIndex = data.findIndex((row) => row.some((cell) => String(cell ?? '').trim()));
  if (headerIndex < 0) throw new Error('The spreadsheet is empty.');
  const headers = data[headerIndex].map((cell) => aliases[normalize(String(cell ?? ''))]);
  const missing = importColumns.filter(([key, , required]) => (required || (submit && key === 'level1Manager')) && !headers.includes(key));
  if (missing.length) throw new Error(`Missing columns: ${missing.map(([, label]) => label).join(', ')}. Use the template headers.`);
  if (headers.some((key, index) => key && headers.indexOf(key) !== index)) throw new Error('Multiple columns match the same lesson field. Keep one column per field.');
  const nonempty = data.slice(headerIndex + 1).map((cells, index) => ({ cells, row: headerIndex + index + 2 }))
    .filter(({ cells }) => cells.some((cell) => String(cell ?? '').trim()));
  if (!nonempty.length) throw new Error('Add at least one lesson below the headers.');
  if (nonempty.length > 500) throw new Error('Upload at most 500 lessons at a time.');
  const seen = new Set(lessons.map((item) => JSON.stringify([item.title.trim().toLowerCase(), item.project.trim().toLowerCase()])));
  return nonempty.map(({ cells, row }) => {
    const fields = Object.fromEntries(importColumns.map(([key]) => [key, headers.includes(key) ? String(cells[headers.indexOf(key)] ?? '').trim() : ''])) as ImportFields;
    const errors: string[] = [];
    for (const [key, label, required] of importColumns) {
      if (!fields[key]) { if (required || (submit && key === 'level1Manager')) errors.push(`${label} is required.`); continue; }
      const lookup = lookupFields[key];
      if (lookup) {
        const values = lookups[lookup];
        if (!values) { errors.push(`${label} options are still loading.`); continue; }
        const match = values.find((value) => value.toLowerCase() === fields[key].toLowerCase());
        if (match) fields[key] = match;
        else errors.push(`${label}: “${fields[key]}” is not a dropdown option.`);
      }
    }
    const identity = JSON.stringify([fields.title.toLowerCase(), (fields.project || 'Company-wide').toLowerCase()]);
    if (seen.has(identity)) errors.push('This title and job number already exist in the app or an earlier spreadsheet row.');
    seen.add(identity);
    return { row, fields, errors };
  });
}

export function downloadTemplate() {
  const content = '\uFEFF' + importColumns.map(([, label]) => `"${label.replaceAll('\"', '\"\"')}"`).join(',') + '\r\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'lessons-import-template.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
