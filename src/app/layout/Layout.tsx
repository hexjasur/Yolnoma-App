import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import StandaloneTabBar from './StandaloneTabBar';
import KeepAliveOutlet from './KeepAliveOutlet';
import { useIsStandalone } from '@/shared/lib/window';

export default function Layout() {
  const isStandalone = useIsStandalone();

  if (isStandalone) {
    return (
      <div className="h-screen flex flex-col bg-[#14110E] text-[#F2EDE6] relative overflow-hidden">
        {/* ambient stage-light glow, sits behind everything */}
        <div
          className="pointer-events-none absolute -top-32 left-1/3 h-[420px] w-[620px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: '#D97757' }}
        />

        {/* Steam-Style Tab Bar - NO SIDEBAR */}
        <StandaloneTabBar />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative z-10">
          <KeepAliveOutlet />
        </main>
      </div>
    );
  }

  // Normal Main Window with Sidebar & Navbar
  return (
    <div className="h-screen flex bg-[#14110E] text-[#F2EDE6] relative overflow-hidden">
      {/* ambient stage-light glow, sits behind everything */}
      <div
        className="pointer-events-none absolute -top-32 left-1/3 h-[420px] w-[620px] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: '#D97757' }}
      />

      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Navbar />

        <div className="flex-1 overflow-y-auto p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}