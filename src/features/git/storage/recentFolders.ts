import { BaseDirectory } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const STORAGE_FILE = "yolnoma-git-recent-folders.json";
const MAX_RECENT_FOLDERS = 8;

async function readFolders(): Promise<string[]> {
  try {
    const raw = await readTextFile(STORAGE_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .slice(0, MAX_RECENT_FOLDERS);
  } catch {
    return [];
  }
}

async function writeFolders(folders: string[]) {
  await writeTextFile(
    STORAGE_FILE,
    JSON.stringify(folders.slice(0, MAX_RECENT_FOLDERS), null, 2),
    {
      baseDir: BaseDirectory.AppData,
    },
  );
}

export async function listRecentGitFolders() {
  return readFolders();
}

export async function rememberGitFolder(folder: string) {
  const cleanFolder = folder.trim();
  if (!cleanFolder) return readFolders();
  const current = await readFolders();
  const next = [cleanFolder, ...current.filter((item) => item !== cleanFolder)];
  await writeFolders(next);
  return next.slice(0, MAX_RECENT_FOLDERS);
}

export async function removeRecentGitFolder(folder: string) {
  const next = (await readFolders()).filter((item) => item !== folder);
  await writeFolders(next);
  return next;
}

export async function clearRecentGitFolders() {
  await writeFolders([]);
}
