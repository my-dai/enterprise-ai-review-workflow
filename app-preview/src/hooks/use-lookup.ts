import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { lookupSources, peopleSources, type LookupKey, type PeopleKey } from '@/data/lookups';

// Loads a dropdown's options from its SharePoint list, sorted A-Z with blanks removed.
export const useLookup = (key: LookupKey) => {
  const source = lookupSources[key];
  const query = useQuery({
    queryKey: ['lookup', key],
    queryFn: async () => {
      const result = await source.load();
      if (!result.success) {
        throw result.error ?? new Error(`Could not load ${source.list}.`);
      }
      return (result.data ?? [])
        .map((row) => row.Title?.trim() ?? '')
        .filter((title: string) => title.length > 0)
        .sort((a: string, b: string) => a.localeCompare(b));
    },
  });

  useEffect(() => {
    if (query.error) {
      console.error(`Loading ${source.list} failed`, query.error);
      toast.error(`Could not load ${source.list} from SharePoint: ${query.error.message}`, { id: `lookup-${key}` });
    }
  }, [query.error, source.list, key]);

  return query.data ?? [];
};

export type Person = { name: string; email: string };

// Loads a role's people (name + email) from the Person column of its SharePoint list, sorted by name.
export const usePeople = (key: PeopleKey) => {
  const source = peopleSources[key];
  const query = useQuery({
    queryKey: ['people', key],
    queryFn: async () => {
      const result = await source.load();
      if (!result.success) {
        throw result.error ?? new Error(`Could not load ${source.list}.`);
      }
      const people = new Map<string, Person>();
      for (const row of result.data ?? []) {
        const email = row.Person?.Email?.trim().toLowerCase();
        if (email) people.set(email, { email, name: row.Person?.DisplayName?.trim() || row.Title?.trim() || email });
      }
      return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  useEffect(() => {
    if (query.error) {
      console.error(`Loading ${source.list} failed`, query.error);
      toast.error(`Could not load ${source.list} from SharePoint: ${query.error.message}`, { id: `people-${key}` });
    }
  }, [query.error, source.list, key]);

  return query.data ?? [];
};
