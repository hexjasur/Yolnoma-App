interface DashboardHeaderProps {
  displayName: string;
  greeting: string;
  osName?: string;
}

export default function DashboardHeader({
  displayName,
  greeting,
  osName,
}: DashboardHeaderProps) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--accent)] mb-2 font-semibold flex items-center gap-2">
        <span>CONTROL PANEL</span>
        {osName && <span className="text-white/30 lowercase">• {osName}</span>}
      </p>
      <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-white m-0 leading-tight">
        {greeting}, {displayName}
      </h1>
      <p className="mt-2 text-sm text-white/40 max-w-2xl">
        Your personal command center for system health and everyday tools.
      </p>
    </div>
  );
}
