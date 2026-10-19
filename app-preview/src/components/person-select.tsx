import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PeopleKey } from '@/data/lookups';
import { usePeople, type Person } from '@/hooks/use-lookup';

// Type-ahead picker over one role's SharePoint people list. The value is the person's email; the name is shown.
export function PersonSelect({ id, label, required, people: key, value, extraPeople = [], onChange }: { id: string; label: string; required?: boolean; people: PeopleKey; value: string; extraPeople?: Person[]; onChange: (email: string) => void }) {
  const [open, setOpen] = useState(false);
  const loaded = usePeople(key);
  const options = [...new Map([...extraPeople, ...loaded].filter((person) => person.email).map((person) => [person.email, person])).values()];
  const selected = options.find((person) => person.email === value);
  return <div><Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} className="mt-2 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-left text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className={`truncate ${selected || value ? '' : 'text-muted-foreground'}`}>{selected?.name ?? (value || 'Type a name')}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name or email" />
          <CommandList>
            <CommandEmpty>No one in this list matches.</CommandEmpty>
            <CommandGroup>{options.map((person) => <CommandItem key={person.email} value={`${person.name} ${person.email}`} onSelect={() => { onChange(person.email); setOpen(false); }}>
              <Check className={`size-4 ${person.email === value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="min-w-0"><span className="block truncate">{person.name}</span><span className="block truncate text-xs text-muted-foreground">{person.email}</span></span>
            </CommandItem>)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
