import type { ChatImage } from "../types";

export const MAX_CHAT_IMAGES = 4;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;

export function imageUrlFromText(value: string): string | null {
  const text = value.trim();
  if (!text || /\s/.test(text)) return null;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const googleImageUrl = url.searchParams.get("imgurl");
    if (googleImageUrl) {
      const imageUrl = new URL(googleImageUrl);
      return imageUrl.protocol === "https:" || imageUrl.protocol === "http:"
        ? imageUrl.href
        : null;
    }

    const isDirectImage = /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(
      url.pathname,
    );
    const isGoogleImageHost =
      /(^|\.)(gstatic\.com|googleusercontent\.com)$/i.test(url.hostname);
    return isDirectImage || isGoogleImageHost ? url.href : null;
  } catch {
    return null;
  }
}

export function readChatImage(file: File): Promise<ChatImage> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error(`${file.name} is not an image.`));
  }
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    return Promise.reject(new Error(`${file.name} is larger than 10 MB.`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve({ url: reader.result, name: file.name });
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
