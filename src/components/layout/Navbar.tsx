import { Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const getTitle = (pathname: string) => {
  if (pathname.startsWith('/tools')) return 'Tools';
  if (pathname.startsWith('/videos')) return 'Streams';
  if (pathname.startsWith('/performances')) return 'Performance';
  if (pathname === '/') return 'Dashboard';

  return 'Performance';
};

export default function Navbar() {
  const { pathname } = useLocation();
  const title = getTitle(pathname);

  return (
    <header className="h-16 shrink-0 border-b border-white/[0.06] bg-[#14110E] px-8 flex items-center justify-between">
      <h2 className="font-serif text-lg font-medium tracking-tight text-[#F2EDE6]">
        {title}
      </h2>

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-white/70
                     hover:text-[#F2EDE6] hover:border-[#D97757]/40 hover:bg-[#D97757]/[0.08]
                     transition-colors duration-150"
        >
          <Settings size={15} strokeWidth={1.75} />
          Sozlamalar
        </button>
      </div>
    </header>
  );
}