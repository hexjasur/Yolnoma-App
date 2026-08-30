import { memo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { SortKey } from '@/types';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',    label: 'New → Old'  },
  { value: 'oldest',   label: 'Old → New'  },
  { value: 'name_asc', label: 'A → Z'          },
  { value: 'name_desc',label: 'Z → A'          },
];

interface SearchBarProps {
  query: string;
  sort:  SortKey;
  total: number;
  onQueryChange: (q: string) => void;
  onSortChange:  (s: SortKey) => void;
}

const SearchBar = memo(function SearchBar({
  query, sort, total, onQueryChange, onSortChange,
}: SearchBarProps) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
      {/* Search input */}
      <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
        <Search
          size={15}
          strokeWidth={1.75}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={`${total} ta ichidan qidiring…`}
          className="form-input"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Sort select */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SlidersHorizontal size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          style={{
            appearance: 'none',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '9px 36px 9px 14px',
            fontSize: 13,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default SearchBar;
