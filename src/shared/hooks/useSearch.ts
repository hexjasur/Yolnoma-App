import { useMemo, useState } from 'react';
import type { Performance, SortKey } from '@/types';

interface UseSearchReturn {
  query: string;
  sort: SortKey;
  filtered: Performance[];
  setQuery: (q: string) => void;
  setSort: (s: SortKey) => void;
}

const SORT_FNS: Record<SortKey, (a: Performance, b: Performance) => number> = {
  name_asc:  (a, b) => a.full_name.localeCompare(b.full_name),
  name_desc: (a, b) => b.full_name.localeCompare(a.full_name),
  newest:    (a, b) => b.created_at.localeCompare(a.created_at),
  oldest:    (a, b) => a.created_at.localeCompare(b.created_at),
};

/**
 * Client-side search + sort over a Performance list.
 * Memoized so filtering only reruns when inputs change.
 */
export function useSearch(items: Performance[]): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = q
      ? items.filter(p => p.full_name.toLowerCase().includes(q))
      : [...items];
    result.sort(SORT_FNS[sort]);
    return result;
  }, [items, query, sort]);

  return { query, sort, filtered, setQuery, setSort };
}
