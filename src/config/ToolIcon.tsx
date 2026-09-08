import type { LucideIcon } from 'lucide-react';

interface ToolIconProps {
  icon: LucideIcon | string;
  className?: string;
}

export function ToolIcon({ icon, className }: ToolIconProps) {
  if (typeof icon === 'string') {
    return <img src={icon} alt="" className={className} />;
  }

  const Icon = icon;
  return <Icon className={className} />;
}