import type { ReactNode } from 'react';
import { Smartphone } from 'lucide-react';
import { isAndroidApp } from '@/shared/lib/platform';

export default function MobileAccessGuard({
  allowed,
  featureName,
  children,
}: {
  allowed: boolean;
  featureName: string;
  children: ReactNode;
}) {
  if (!isAndroidApp() || allowed) return <>{children}</>;

  return (
    <section className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl">
        <Smartphone className="mx-auto mb-4 h-10 w-10 text-cyan-300" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-white">Desktop-only feature</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          {featureName} vaqtincha Android test build’da mavjud emas. Mobile-compatible sahifalar ustida ish davom etmoqda.
        </p>
      </div>
    </section>
  );
}
