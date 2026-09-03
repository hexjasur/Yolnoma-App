import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { reportError } from '@/shared/lib/errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ errorInfo: info });
    reportError('ui.render', { error, componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = () => {
    const errorText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown'}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#14110E] p-6 text-center text-[#F2EDE6]">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-[#181410] p-8 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon size={24} />
            </div>

            <h1 className="font-serif text-2xl font-medium text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/60">
              An unexpected error occurred in the application. You can try to reset the current view or reload the app.
            </p>

            {error && (
              <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-left">
                <p className="text-xs font-mono text-red-400 break-words font-medium">
                  {error.name}: {error.message}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.06] text-white/80 border border-white/10 hover:bg-white/[0.1] hover:text-white transition-all cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-[#D97757] hover:bg-[#c96a48] text-white transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D97757]/20"
              >
                <RefreshCw size={13} />
                Reload Application
              </button>
            </div>

            {/* Details toggle */}
            <div className="mt-6 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-white/40 hover:text-white/70 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>

              {showDetails && (
                <div className="mt-3 text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Stack Trace</span>
                    <button
                      type="button"
                      onClick={this.handleCopy}
                      className="text-[11px] text-white/50 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-y-auto text-[11px] font-mono text-white/50 bg-black/60 p-3 rounded-lg border border-white/5 whitespace-pre-wrap break-all select-all">
                    {error?.stack || 'No stack trace available.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
