import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  loading?: boolean;
  itemLabel?: string;
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [15, 20, 40],
  loading = false,
  itemLabel = 'items',
}: PaginationProps) {
  if (total === 0) return null;

  const safeTotalPages = Math.max(totalPages, 1);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = Array.from({ length: safeTotalPages }, (_, index) => index + 1)
    .filter((value) => value === 1 || value === safeTotalPages || Math.abs(value - page) <= 2);
  const canGoPrevious = page > 1 && !loading;
  const canGoNext = page < safeTotalPages && !loading;

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
        <span>
          Showing <strong className="text-[var(--text-primary)]">{start}–{end}</strong> of{' '}
          <strong className="text-[var(--text-primary)]">{total}</strong> {itemLabel}
        </span>
        {onLimitChange && (
          <label className="flex items-center gap-2">
            <span>Per page</span>
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              disabled={loading}
              className="rounded-md border border-[var(--border)] bg-white/[0.04] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              aria-label="Items per page"
            >
              {limitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white/[0.04] px-2.5 py-1.5 text-xs text-[var(--text-primary)] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        {pages.map((value, index) => {
          const previous = pages[index - 1];
          return (
            <span key={value} className="inline-flex items-center gap-1">
              {previous && value - previous > 1 && <span className="px-1 text-[var(--text-faint)]">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(value)}
                disabled={loading}
                aria-current={value === page ? 'page' : undefined}
                className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs transition ${value === page
                  ? 'border-[var(--accent)] bg-[var(--accent)] font-bold text-white'
                  : 'border-[var(--border)] bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.08]'} disabled:cursor-not-allowed`}
              >
                {value}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white/[0.04] px-2.5 py-1.5 text-xs text-[var(--text-primary)] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
