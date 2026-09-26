import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectMenuOption {
  value: string;
  label: string;
}

interface SelectMenuProps {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

export default function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = "",
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (open) selectedOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full min-w-[132px] items-center justify-between gap-3 rounded-lg bg-white/[0.055] px-3.5 py-2 text-left text-xs font-medium text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:bg-white/[0.11] hover:shadow-[0_6px_18px_rgba(0,0,0,0.18)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180 text-[var(--accent)]" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 z-50 mt-2 max-h-[min(24rem,60vh)] min-w-full overflow-y-auto overscroll-contain rounded-xl bg-[#211b17] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                ref={active ? selectedOptionRef : undefined}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                  active
                    ? "bg-[var(--accent)]/15 font-semibold text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{option.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
