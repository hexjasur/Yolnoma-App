import { useState } from "react";
import type { ChatImage } from "../types";
import { MAX_CHAT_IMAGES, readChatImage } from "../utils/imageAttachments";

export function useChatImages(onError: (message: string) => void) {
  const [images, setImages] = useState<ChatImage[]>([]);

  const addFiles = async (files: File[]) => {
    if (files.length > MAX_CHAT_IMAGES - images.length) {
      onError(`Attach up to ${MAX_CHAT_IMAGES} images per message.`);
      return;
    }
    try {
      const loadedImages = await Promise.all(files.map(readChatImage));
      setImages((current) => [...current, ...loadedImages]);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  const addUrl = (url: string) => {
    if (images.length >= MAX_CHAT_IMAGES) {
      onError(`Attach up to ${MAX_CHAT_IMAGES} images per message.`);
      return;
    }
    setImages((current) => [...current, { url, name: new URL(url).hostname }]);
    onError("");
  };

  const remove = (index: number) => {
    setImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  return { images, setImages, addFiles, addUrl, remove };
}
