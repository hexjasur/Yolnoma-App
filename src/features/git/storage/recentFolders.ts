const STORAGE_KEY = "yolnoma:commit-generator:recent-folders";
const MAX_RECENT_FOLDERS = 8;

function readRecentFolders(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
          .slice(0, MAX_RECENT_FOLDERS)
      : [];
  } catch {
    return [];
  }
}

function writeRecentFolders(folders: string[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(folders.slice(0, MAX_RECENT_FOLDERS)),
    );
  } catch {
    // Keep the workspace usable if browser storage is unavailable.
  }
}

export function listRecentGitFolders() {
  return readRecentFolders();
}

export function rememberGitFolder(folder: string) {
  const cleanFolder = folder.trim();
  if (!cleanFolder) return readRecentFolders();

  const next = [
    cleanFolder,
    ...readRecentFolders().filter((item) => item !== cleanFolder),
  ].slice(0, MAX_RECENT_FOLDERS);
  writeRecentFolders(next);
  return next;
}

export function removeRecentGitFolder(folder: string) {
  const next = readRecentFolders().filter((item) => item !== folder);
  writeRecentFolders(next);
  return next;
}
