import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export default function SearchInput({ onClear, className = '', value, ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value);
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
      <input
        {...props}
        type="text"
        value={value}
        className={`form-input pr-9 pl-10 ${className}`.trim()}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-faint)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
