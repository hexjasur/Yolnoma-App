/**
 * updaterStore — Global auto-updater state & service for Tauri 2.
 *
 * Handles:
 * - Periodic/startup automated background checks
 * - Manual update checks from Settings/About
 * - Real-time download progress tracking (0-100%)
 * - NSIS passive installation and app relaunch
 * - Non-intrusive error reporting
 */

import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { toast } from '@/shared/ui/Toast';
import { getErrorMessage, reportError } from '@/shared/lib/errors';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'downloading'
  | 'installing'
  | 'up-to-date'
  | 'error';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

interface UpdaterState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: number; // 0 to 100
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;
  modalOpen: boolean;
  lastChecked: Date | null;

  /** Check for available updates (silent for startup check, non-silent for manual clicks) */
  checkForUpdates: (options?: { silent?: boolean }) => Promise<boolean>;

  /** Download and install the available update, then relaunch the app */
  downloadAndInstall: () => Promise<void>;

  /** Show the update dialog */
  openModal: () => void;

  /** Close/dismiss the update dialog */
  closeModal: () => void;

  /** Reset status back to idle */
  reset: () => void;
}

// Module-level reference to the active Tauri Update instance
let activeUpdate: Update | null = null;
let isChecking = false;

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  status: 'idle',
  updateInfo: null,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  modalOpen: false,
  lastChecked: null,

  checkForUpdates: async (options = { silent: false }) => {
    const { silent } = options;
    const currentStatus = get().status;

    // Prevent duplicate or overlapping checks
    if (isChecking || currentStatus === 'checking' || currentStatus === 'downloading' || currentStatus === 'installing') {
      return false;
    }

    isChecking = true;
    set({ status: 'checking', error: null });

    let currentVersion = '0.9.53';
    try {
      currentVersion = await getVersion();
    } catch {
      // Fallback if running outside Tauri context
    }

    try {
      const update = await check();
      set({ lastChecked: new Date() });

      if (update && update.available) {
        activeUpdate = update;
        const info: UpdateInfo = {
          version: update.version,
          currentVersion,
          date: update.date,
          body: update.body || 'Bug fixes and performance improvements.',
        };

        set({
          status: 'update-available',
          updateInfo: info,
          modalOpen: true,
          error: null,
        });

        isChecking = false;
        return true;
      } else {
        activeUpdate = null;
        set({
          status: 'up-to-date',
          updateInfo: null,
          error: null,
        });

        if (!silent) {
          toast.success(`You are on the latest version (v${currentVersion}).`);
        }

        isChecking = false;
        return false;
      }
    } catch (err: unknown) {
      reportError('AutoUpdater', err);
      const msg = getErrorMessage(err, 'Could not check for updates.');

      set({
        status: 'error',
        error: msg,
      });

      if (!silent) {
        toast.error(msg);
      }

      isChecking = false;
      return false;
    }
  },

  downloadAndInstall: async () => {
    const { status } = get();
    if (status === 'downloading' || status === 'installing') return;

    if (!activeUpdate) {
      toast.error('No update package is currently loaded. Please check for updates again.');
      return;
    }

    set({
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
    });

    try {
      let downloaded = 0;
      let total: number | null = null;

      await activeUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started': {
            total = event.data.contentLength ?? null;
            set({ totalBytes: total, progress: 0 });
            break;
          }
          case 'Progress': {
            downloaded += event.data.chunkLength;
            let percent = 0;
            if (total && total > 0) {
              percent = Math.min(100, Math.round((downloaded / total) * 100));
            }
            set({
              downloadedBytes: downloaded,
              totalBytes: total,
              progress: percent,
            });
            break;
          }
          case 'Finished': {
            set({
              status: 'installing',
              progress: 100,
            });
            break;
          }
        }
      });

      // Once download & passive install finishes, relaunch the application
      set({ status: 'installing', progress: 100 });
      await relaunch();
    } catch (err: unknown) {
      reportError('AutoUpdater:Download', err);
      const msg = getErrorMessage(err, 'Failed to download or install update.');
      set({
        status: 'error',
        error: msg,
      });
      toast.error(msg);
    }
  },

  openModal: () => set({ modalOpen: true }),
  closeModal: () => {
    const { status } = get();
    // Do not allow closing during active download or installation
    if (status === 'downloading' || status === 'installing') return;
    set({ modalOpen: false });
  },

  reset: () => {
    activeUpdate = null;
    isChecking = false;
    set({
      status: 'idle',
      updateInfo: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      modalOpen: false,
    });
  },
}));
