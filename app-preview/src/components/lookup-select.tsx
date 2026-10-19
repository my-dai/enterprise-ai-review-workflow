import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LookupKey } from '@/data/lookups';
import { useLookup } from '@/hooks/use-lookup';

// Dropdown whose options come from an LL_* SharePoint list.
export function LookupSelect({ id, label, required, lookup, value, extraOptions = [], onChange }: { id: string; label: string; required?: boolean; lookup: LookupKey; value: string; extraOptions?: string[]; onChange: (value: string) => void }) {
  const loaded = useLookup(lookup);
  const options = [...new Set([...extraOptions, ...loaded, value].filter((option) => option.length > 0))];
  return <div><Label htmlFor={id}>{label}{required ? ' *' : ''}</Label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="mt-2 w-full"><SelectValue placeholder="Find items" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>;
}
