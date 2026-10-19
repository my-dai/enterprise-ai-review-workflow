import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkflow, type LessonFields } from '@/lib/workflow-data';
import { useLookup, usePeople } from '@/hooks/use-lookup';
import { downloadTemplate, importColumns, parseCsv, validateImport } from '@/lib/lesson-import';

export default function ImportLessonsPage() {
  const { actor, lessons, addLessons, loading } = useWorkflow();
  const topics = useLookup('topic');
  const disciplines = useLookup('discipline');
  const companies = useLookup('company');
  const authors = usePeople('author');
  const managers = usePeople('level1Manager');
  const lookups = useMemo(() => ({ topic: topics, discipline: disciplines, company: companies, author: [...new Set([...authors.map((person) => person.email), actor].filter(Boolean))], level1Manager: managers.map((person) => person.email) }), [topics, disciplines, companies, authors, actor, managers]);
  const [data, setData] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'Draft' | 'Reviewer 1 review'>('Reviewer 1 review');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const imported = useRef(false);
  const preview = useMemo(() => {
    if (!data) return { rows: [], error: '' };
    try { return { rows: validateImport(data, lookups, lessons, status === 'Reviewer 1 review'), error: '' }; }
    catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : 'Unable to validate this spreadsheet.' }; }
  }, [data, lookups, lessons, status]);
  const invalid = preview.rows.filter((row) => row.errors.length).length;
  const readFile = async (file: File) => {
    setBusy(true); setData(null); setError(''); setSuccess(''); setFileName(file.name); setPage(0); imported.current = false;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.');
      if (/\.csv$/i.test(file.name)) setData(parseCsv(await file.text()));
      else if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        setData(await readSheet(file));
      } else throw new Error('Choose an Excel (.xlsx) or CSV (.csv) file. Save older .xls files as .xlsx first.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read this file. Save it as .xlsx or CSV and try again.'); }
    finally { setBusy(false); }
  };
  const importLessons = async () => {
    if (busy || loading || !actor || imported.current || !preview.rows.length || preview.error || invalid) return;
    setBusy(true);
    imported.current = true;
    const fields: LessonFields[] = preview.rows.map(({ fields: row }) => ({
      ...row, lesson: row.lesson || row.recommendation, jobType: row.jobType || 'Other', category: row.category || 'Quality',
      project: row.project || 'Company-wide', projectBased: Boolean(row.project), customer: '',
      costImpact: '', csiDivision: '', deliverySystem: '', sme: '', qualityManager: '', attachments: [],
    }));
    try {
      const result = await addLessons(fields, status);
      if (result.error) {
        setError(`${result.imported} of ${fields.length} lessons imported. The next lesson failed: ${result.error}. Remove imported rows before retrying.`);
        setData(null); setFileName('');
        if (fileInput.current) fileInput.current.value = '';
        toast.error('The batch stopped before all lessons were imported.');
      } else {
        const message = `${result.imported} lessons ${status === 'Draft' ? 'saved as drafts' : 'submitted for Reviewer 1 review'}.`;
        setSuccess(message); toast.success(message); setData(null); setFileName('');
        if (fileInput.current) fileInput.current.value = '';
      }
    } catch (cause) { setError(`Could not complete the import: ${cause instanceof Error ? cause.message : String(cause)}. Check Home before retrying.`); setData(null); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-muted-foreground">STEP 01 · CAPTURE</p>
      <h1 className="text-2xl font-bold">Batch upload lessons</h1>
      <p className="text-muted-foreground">Upload a spreadsheet, review the rows, and import your lessons together.</p>
    </div>
    <p className="rounded-md border bg-muted p-3 text-sm">Imported lessons are saved to SharePoint and enter the same approval workflow as lessons entered in the form.</p>
    <Card><CardHeader><CardTitle>1. Prepare your spreadsheet</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Download the CSV template and open it in Excel or your spreadsheet app. Keep the headers and enter one lesson per row. Required columns match the lesson form. Upload CSV or .xlsx, up to 500 lessons and 5 MB. Excel imports use the first worksheet.</p>
      <Button variant="outline" onClick={downloadTemplate}><Download />Download template</Button>
      <details className="text-sm"><summary className="cursor-pointer font-medium">View accepted dropdown values</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{([['Topic', topics], ['Discipline', disciplines], ['Company', companies], ['Author email', lookups.author], ['Level 1 Manager email', lookups.level1Manager]] as const).map(([label, values]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-muted-foreground">{values.join(', ') || 'No options loaded'}</dd></div>)}</dl>
      </details>
      <div><Label htmlFor="spreadsheet">Spreadsheet file</Label><Input ref={fileInput} id="spreadsheet" type="file" accept=".csv,.xlsx" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /></div>
      {busy && <p role="status">Reading spreadsheet…</p>}
      {(error || preview.error) && <p role="alert" className="text-sm text-destructive">{error || preview.error}</p>}
      {success && <div role="status" className="rounded-md border p-4"><p>{success}</p><p className="mt-1 text-sm text-muted-foreground">Drafts can be edited from Home. Submitted lessons enter the approval workflow.</p><Button asChild variant="link" className="px-0"><Link to="/">View Home</Link></Button></div>}
    </CardContent></Card>
    {preview.rows.length > 0 && <Card><CardHeader><CardTitle>2. Review and import</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="break-words text-sm">{fileName} · {preview.rows.length} lessons · {invalid} rows need correction</p>
      {invalid > 0 && <p role="alert" className="text-sm text-destructive">Correct the flagged rows in your spreadsheet and upload it again. No lessons have been imported.</p>}
      <div className="max-h-[32rem] overflow-auto rounded-md border" tabIndex={0} aria-label="Spreadsheet preview">
        <table className="w-full text-left text-sm"><caption className="sr-only">Lesson preview with spreadsheet row numbers and validation errors</caption><thead className="sticky top-0 bg-muted"><tr><th scope="col" className="p-3">Row</th><th scope="col" className="p-3">Validation</th>{importColumns.map(([key, label]) => <th scope="col" className="min-w-48 p-3" key={key}>{label}</th>)}</tr></thead>
          <tbody>{preview.rows.slice(page * 25, (page + 1) * 25).map((row) => <tr key={row.row} className="border-t align-top"><th scope="row" className="p-3">{row.row}</th><td className="min-w-64 p-3">{row.errors.length ? <ul className="list-disc space-y-1 pl-4 text-destructive">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : 'Ready'}</td>{importColumns.map(([key]) => <td key={key} className="max-w-80 whitespace-pre-wrap break-words p-3">{row.fields[key]}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {preview.rows.length > 25 && <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm">Page {page + 1} of {Math.ceil(preview.rows.length / 25)}</span><Button variant="outline" disabled={(page + 1) * 25 >= preview.rows.length} onClick={() => setPage(page + 1)}>Next</Button></div>}
      <div className="flex flex-wrap items-end justify-between gap-4"><div><Label htmlFor="import-status">Import as</Label><select id="import-status" className="mt-1 block h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'Draft' | 'Reviewer 1 review')}><option value="Reviewer 1 review">Submit for review</option><option value="Draft">Save as drafts</option></select></div>
        <Button onClick={() => void importLessons()} disabled={busy || loading || !actor || invalid > 0}><Upload />Import {preview.rows.length} lessons</Button>
      </div>
    </CardContent></Card>}
  </div>;
}
