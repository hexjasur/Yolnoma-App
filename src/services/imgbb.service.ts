import type { ImgBBResponse, UploadState } from '@/types';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY as string;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

if (!IMGBB_API_KEY) {
  console.warn('[imgbb] VITE_IMGBB_API_KEY is not set — image uploads will fail.');
}

/**
 * Upload a local File to ImgBB and return the hosted URL.
 * Reports progress via onProgress(0–100).
 */
export async function uploadImage(
  file: File,
  onProgress?: (state: UploadState) => void,
): Promise<string> {
  const emit = (state: UploadState) => onProgress?.(state);

  // 1. Read file as base64
  emit({ phase: 'reading', progress: 0 });
  const base64 = await fileToBase64(file);

  // 2. Upload via XHR so we can track real upload progress
  emit({ phase: 'uploading', progress: 0 });
  return new Promise<string>((resolve, reject) => {
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);
    formData.append('name', file.name.replace(/\.[^.]+$/, ''));

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        emit({ phase: 'uploading', progress: pct });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res: ImgBBResponse = JSON.parse(xhr.responseText);
          if (!res.success) throw new Error('ImgBB upload failed');
          const url = res.data.url;
          emit({ phase: 'done', progress: 100, url });
          resolve(url);
        } catch (err) {
          const msg = 'Serverdan noto\'g\'ri javob keldi';
          emit({ phase: 'error', progress: 0, error: msg });
          reject(new Error(msg));
        }
      } else {
        const msg = `ImgBB error: ${xhr.status}`;
        emit({ phase: 'error', progress: 0, error: msg });
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => {
      const msg = 'Tarmoq xatosi — rasm yuklanmadi';
      emit({ phase: 'error', progress: 0, error: msg });
      reject(new Error(msg));
    });

    xhr.open('POST', `${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`);
    xhr.send(formData);
  });
}

/** Read a File and return its base64-encoded content (without the data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Faylni o\'qib bo\'lmadi'));
    reader.readAsDataURL(file);
  });
}

/** Validate that a file is an image and within a size limit (default 32 MB). */
export function validateImageFile(file: File, maxMb = 32): string | null {
  if (!file.type.startsWith('image/')) return 'Faqat rasm fayllari qabul qilinadi';
  if (file.size > maxMb * 1024 * 1024) return `Fayl hajmi ${maxMb} MB dan oshmasligi kerak`;
  return null;
}
