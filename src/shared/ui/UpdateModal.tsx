import { Download, RefreshCw, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { useUpdaterStore } from '@/shared/stores/updaterStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function UpdateModal() {
  const {
    status,
    updateInfo,
    progress,
    downloadedBytes,
    totalBytes,
    error,
    modalOpen,
    closeModal,
    downloadAndInstall,
  } = useUpdaterStore();

  if (!modalOpen || !updateInfo) return null;

  const isDownloading = status === 'downloading';
  const isInstalling = status === 'installing';
  const isBusy = isDownloading || isInstalling;

  return (
    <Modal
      open={modalOpen}
      onClose={closeModal}
      title="Software Update"
      subtitle="YOLNOMA UPDATER"
      maxWidth="max-w-[480px]"
      footer={
        <div className="flex items-center justify-between w-full">
          {!isBusy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={closeModal}
              disabled={isBusy}
            >
              Later
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {isBusy ? (
              <Button variant="primary" size="sm" loading disabled>
                {isDownloading ? `Downloading (${progress}%)` : 'Installing & Relaunching...'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={downloadAndInstall}
                className="gap-2"
              >
                <Download size={14} />
                Update Now
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Version Change Badge */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">New Version Available</p>
              <div className="flex items-center gap-2 mt-0.5 font-mono">
                <span className="text-white/40 text-xs">v{updateInfo.currentVersion}</span>
                <ArrowRight size={12} className="text-amber-400" />
                <span className="text-amber-400 font-bold text-sm">v{updateInfo.version}</span>
              </div>
            </div>
          </div>

          {updateInfo.date && (
            <span className="text-[11px] text-white/40 font-mono">
              {new Date(updateInfo.date).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Release Notes */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Release Notes</p>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-white/80 max-h-36 overflow-y-auto font-sans leading-relaxed text-xs">
            {updateInfo.body || 'Bug fixes, performance improvements, and security updates.'}
          </div>
        </div>

        {/* Progress Display */}
        {isBusy && (
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-[#D97757]" />
                {isDownloading ? 'Downloading installer...' : 'Applying update...'}
              </span>
              <span className="font-mono text-[#D97757] font-semibold">
                {isDownloading ? `${progress}%` : 'Finalizing'}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D97757] to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${isInstalling ? 100 : Math.max(5, progress)}%` }}
              />
            </div>

            {totalBytes && totalBytes > 0 && isDownloading && (
              <p className="text-[11px] text-white/40 font-mono text-right">
                {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
              </p>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Info notice */}
        {!isBusy && !error && (
          <p className="text-[11px] text-white/40 text-center">
            The update will download and install in passive mode, then seamlessly relaunch.
          </p>
        )}
      </div>
    </Modal>
  );
}
