import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/shared/lib/errors';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError('ui.render', { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#14110E] p-6 text-center text-[#F2EDE6]">
          <div className="max-w-md rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-7">
            <h1 className="font-serif text-2xl font-medium">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/55">Please reload the app. The issue has been recorded locally.</p>
            <button className="btn btn-primary mt-5 px-[18px] py-[9px] text-[14px]" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
