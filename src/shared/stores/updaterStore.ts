/**
 * updaterStore — Global auto-updater state & service for Tauri 2.
 *
 * Handles:
 * - Periodic/startup automated background checks
 * - Manual update checks from Settings/About
 * - Real-time download progress tracking (0-100%)
 * - NSIS passive installation and app relaunch
 * - Non-intrusive error reporting
 * - Infinite update loop protection: if an update for version X is attempted
 *   but the app still starts on the previous version after relaunch, version X
 *   is recorded as a failed target and will not be offered again until a newer
 *   version (Y > X) becomes available.
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

// ---------------------------------------------------------------------------
// Infinite-update-loop protection
// ---------------------------------------------------------------------------
// Before installing we persist the target version to localStorage.
// On the next startup, if the running version still equals the old version
// (meaning the installer silently failed or did nothing), we skip offering
// that same version again.
// A genuinely newer version is always allowed through.
// ---------------------------------------------------------------------------
const FAILED_TARGET_KEY = 'yolnoma.updater.failed-target';

function getFailedTarget(): string | null {
  try {
    return localStorage.getItem(FAILED_TARGET_KEY);
  } catch {
    return null;
  }
}

function setFailedTarget(version: string): void {
  try {
    localStorage.setItem(FAILED_TARGET_KEY, version);
  } catch {
    // localStorage unavailable (e.g. test environment) — ignore
  }
}

function clearFailedTarget(): void {
  try {
    localStorage.removeItem(FAILED_TARGET_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Module-level concurrency guards
// ---------------------------------------------------------------------------
// isChecking prevents overlapping check() calls.
// isInstalling prevents overlapping downloadAndInstall() calls.
// Both mirror the corresponding Zustand status values but live outside the
// store so they are not susceptible to stale-closure capture.
// ---------------------------------------------------------------------------
let activeUpdate: Update | null = null;
let isChecking = false;
let isInstalling = false;

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

    // Prevent duplicate or overlapping checks / installs
    if (
      isChecking ||
      isInstalling ||
      currentStatus === 'checking' ||
      currentStatus === 'downloading' ||
      currentStatus === 'installing'
    ) {
      return false;
    }

    isChecking = true;
    set({ status: 'checking', error: null });

    let currentVersion: string;
    try {
      currentVersion = await getVersion();
    } catch (err: unknown) {
      reportError('AutoUpdater:GetVersion', err);
      const msg = getErrorMessage(err, 'Could not determine current application version.');
      set({ status: 'error', error: msg });
      if (!silent) {
        toast.error(msg);
      }
      isChecking = false;
      return false;
    }

    if (!currentVersion || typeof currentVersion !== 'string') {
      const msg = 'Current application version is unavailable.';
      set({ status: 'error', error: msg });
      if (!silent) {
        toast.error(msg);
      }
      isChecking = false;
      return false;
    }

    // -----------------------------------------------------------------------
    // Detect whether a previously attempted update actually succeeded.
    // If the running version now matches the previously stored failed-target,
    // the update DID succeed — clear the guard.
    // -----------------------------------------------------------------------
    const failedTarget = getFailedTarget();
    if (failedTarget && failedTarget === currentVersion) {
      // Running version matches what we tried to install → success. Clear it.
      clearFailedTarget();
    }

    try {
      const update = await check();
      set({ lastChecked: new Date() });

      if (update && update.available) {
        // -------------------------------------------------------------------
        // Infinite-loop guard: skip if this exact version was already
        // attempted and the app is still running the previous version.
        // -------------------------------------------------------------------
        const currentFailedTarget = getFailedTarget();
        if (currentFailedTarget && update.version === currentFailedTarget) {
          activeUpdate = null;
          const skipMsg = `Update to v${update.version} previously failed. It will not be offered again until a newer version is released.`;
          set({ status: 'error', error: skipMsg });

          if (!silent) {
            toast.error(`Update v${update.version} failed on last attempt. Waiting for a newer release.`);
          }

          isChecking = false;
          return false;
        }

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

    // Concurrency guard — do not allow two simultaneous install attempts
    if (isInstalling || status === 'downloading' || status === 'installing') return;

    if (!activeUpdate) {
      toast.error('No update package is currently loaded. Please check for updates again.');
      return;
    }

    // -----------------------------------------------------------------------
    // Record the target version BEFORE starting the install.
    // If the app restarts and is still on the current (old) version, this key
    // will cause checkForUpdates to skip offering the same version again.
    // The key is cleared automatically on the next startup if the running
    // version has advanced to the target.
    // -----------------------------------------------------------------------
    setFailedTarget(activeUpdate.version);

    isInstalling = true;
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

      // Once download & passive install finishes, relaunch the application.
      // On the next startup, if the version has advanced, clearFailedTarget()
      // is called in checkForUpdates and everything continues normally.
      set({ status: 'installing', progress: 100 });
      await relaunch();
    } catch (err: unknown) {
      reportError('AutoUpdater:Download', err);
      const msg = getErrorMessage(err, 'Failed to download or install update.');
      isInstalling = false;
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
    isInstalling = false;
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

