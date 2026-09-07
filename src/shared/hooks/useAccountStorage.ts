/**
 * Thin wrappers around the Tauri `account_storage` commands for
 * reading and writing the OpenRouter API key.
 *
 * The actual in-memory cache lives on the Rust side (ApiKeyCache).
 * React never stores the key in localStorage or sessionStorage.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Retrieve the decrypted API key from secrets.dat.
 * Returns null if no key has been saved yet for this account.
 */
export async function getApiKey(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    return await invoke<string | null>('get_api_key', { userId });
  } catch (err) {
    console.error('[useAccountStorage] get_api_key error:', err);
    return null;
  }
}

/**
 * Encrypt and persist the API key to secrets.dat for the given account.
 * Also updates the in-memory Rust-side cache.
 */
export async function saveApiKey(userId: string, apiKey: string): Promise<void> {
  if (!userId) return;
  await invoke('set_api_key', { userId, apiKey });
}

/**
 * Remove the API key from disk and from the Rust-side memory cache.
 */
export async function removeApiKey(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await invoke('clear_api_key', { userId });
  } catch (err) {
    console.error('[useAccountStorage] clear_api_key error:', err);
  }
}
