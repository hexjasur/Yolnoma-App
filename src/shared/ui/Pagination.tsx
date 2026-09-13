import { ChevronLeft, ChevronRight } from 'lucide-react';
import SelectMenu from './SelectMenu';

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
    <div className="flex items-center justify-between gap-4 flex-wrap px-1 py-2">
      <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
        <span>
          Showing <strong className="text-[var(--text-primary)]">{start}–{end}</strong> of{' '}
          <strong className="text-[var(--text-primary)]">{total}</strong> {itemLabel}
        </span>
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span>Per page</span>
            <SelectMenu
              value={String(limit)}
              onChange={(value) => onLimitChange(Number(value))}
              disabled={loading}
              ariaLabel="Items per page"
              options={limitOptions.map((option) => ({ value: String(option), label: String(option) }))}
              className="min-w-[92px]"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
          aria-label="Previous page"
          title="Previous page"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.14] hover:text-white hover:shadow-[0_6px_18px_rgba(0,0,0,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:translate-y-0 disabled:hover:bg-white/[0.06]"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
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
                className={`h-10 min-w-10 rounded-md px-2.5 text-sm transition-all duration-200 ${value === page
                  ? 'bg-[var(--accent)] font-bold text-white shadow-[0_5px_16px_rgba(217,119,87,0.28)]'
                  : 'bg-white/[0.06] font-medium text-[var(--text-muted)] hover:-translate-y-0.5 hover:bg-white/[0.14] hover:text-white hover:shadow-[0_6px_18px_rgba(0,0,0,0.22)]'} disabled:cursor-not-allowed disabled:hover:translate-y-0`}
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
          aria-label="Next page"
          title="Next page"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.14] hover:text-white hover:shadow-[0_6px_18px_rgba(0,0,0,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:translate-y-0 disabled:hover:bg-white/[0.06]"
        >
          <ChevronRight size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
