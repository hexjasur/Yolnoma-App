import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'ghost' | 'secondary' | 'danger' | 'accent';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'bg-white/[0.045] text-white/65 hover:bg-white/[0.11] hover:text-white',
  secondary: 'bg-white/[0.06] text-white/70 hover:bg-white/[0.14] hover:text-white',
  danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200',
  accent: 'bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757]/20 hover:text-[#e99578]',
};

export default function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <button
      type={type}
      className={`inline-flex ${sizeClass} items-center justify-center rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
