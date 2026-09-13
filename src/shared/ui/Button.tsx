import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-[18px] py-[9px] text-[14px]',
  lg: 'px-6 py-3 text-[15px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = iconOnly ? 'btn btn-icon' : 'btn';
  const cls  = `${base} btn-${variant} ${iconOnly ? '' : SIZE_CLASSES[size]} ${className}`.trim();

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Spinner />
          {typeof children === 'string' ? children : null}
        </>
      ) : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin-slow"
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
