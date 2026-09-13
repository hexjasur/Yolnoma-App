import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  onClear?: () => void;
  size?: 'sm' | 'md' | 'lg';
  width?: 'compact' | 'standard' | 'wide' | 'full';
}

const SIZE_CLASSES = {
  sm: { input: 'h-9 !pl-11 pr-9 text-xs', icon: 14, iconPosition: 'left-3.5', clear: 13 },
  md: { input: 'h-11 !pl-12 pr-10 text-sm', icon: 16, iconPosition: 'left-4', clear: 14 },
  lg: { input: 'h-12 !pl-[3.25rem] pr-11 text-base', icon: 18, iconPosition: 'left-[1.125rem]', clear: 15 },
} as const;

const WIDTH_CLASSES = {
  compact: 'w-56 sm:w-64',
  standard: 'w-full sm:min-w-[320px] sm:flex-1',
  wide: 'w-full sm:min-w-[420px] md:min-w-[560px] lg:min-w-[680px] sm:flex-1',
  full: 'w-full',
} as const;

export default function SearchInput({ onClear, size = 'md', width = 'full', className = '', value, ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value);
  const styles = SIZE_CLASSES[size];
  return (
    <div className={`relative min-w-0 ${WIDTH_CLASSES[width]} ${className}`.trim()}>
      <Search
        size={styles.icon}
        className={`pointer-events-none absolute ${styles.iconPosition} top-1/2 -translate-y-1/2 text-[var(--text-faint)]`}
      />
      <input
        {...props}
        type="text"
        value={value}
        className={`form-input w-full ${styles.input}`.trim()}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-faint)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
        >
          <X size={styles.clear} />
        </button>
      )}
    </div>
  );
}
