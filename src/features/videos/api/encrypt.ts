const encodedKey = import.meta.env.VITE_ABC_KEY;
const key = encodedKey?.replace(/_/g, '');

const _0x03 = 0x03;
const _0x15 = 0x15;
const _0x0a = 0x0a;
const _0x0b = 0x0b;
const _0x08 = 0x08;
const _0x0c = 0x0c;
const _0x17 = 0x17;
const _0x0d = 0x0d;
const _0x07 = 0x07;

export const BASE_URLS = key
  ? [
    `https://${key[_0x03]}${key[_0x03]}${key[_0x03]}.${key[_0x15]}${key[_0x0a]}${key[_0x0b]}${key[_0x08]}${key[_0x0c]}${key[_0x15]}${key[_0x08]}.${key[_0x17]}${key[_0x0b]}${key[_0x0d]}`,

    `https://${key[_0x15]}${key[_0x07]}.${key[_0x15]}${key[_0x0a]}${key[_0x0b]}${key[_0x08]}${key[_0x0c]}${key[_0x15]}${key[_0x08]}.${key[_0x17]}${key[_0x0b]}${key[_0x0d]}`,
  ]
  : [];

export function getEmbedUrl(server: 'www' | 'es', videoId: string): string {
  const baseUrl = BASE_URLS[server === 'www' ? 0 : 1];
  return baseUrl ? `${baseUrl}/embed/${videoId}/` : '';
}