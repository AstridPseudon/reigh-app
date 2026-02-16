import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const FULL_URL_PATTERN = /^(https?:|blob:|data:)/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cropFilename(filename: string, maxLength: number = 24): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const extension = filename.split('.').pop() || '';
  const nameWithoutExtension = filename.substring(0, filename.length - extension.length - 1);
  const croppedLength = maxLength - extension.length - 4;

  if (croppedLength <= 0) {
    return `...${extension}`;
  }

  return `${nameWithoutExtension.substring(0, croppedLength)}...${extension}`;
}

export const fileToDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export const dataURLtoFile = (
  dataUrl: string,
  filename: string,
  fileType?: string
): File | null => {
  try {
    const [metadata, payload] = dataUrl.split(',');
    if (!metadata || !payload) {
      throw new Error('Invalid Data URL format');
    }

    const mimeMatch = metadata.match(/:(.*?);/);
    const mimeType =
      fileType ||
      (mimeMatch && mimeMatch[1]) ||
      'application/octet-stream';
    const decodedPayload = atob(payload);
    const bytes = new Uint8Array(decodedPayload.length);

    for (let i = 0; i < decodedPayload.length; i += 1) {
      bytes[i] = decodedPayload.charCodeAt(i);
    }

    return new File([bytes], filename, { type: mimeType });
  } catch {
    return null;
  }
};

const withCacheBust = (url: string): string => {
  if (url.includes('?t=')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

const getEffectiveBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_API_TARGET_URL || '';
  }

  const configuredBase = import.meta.env.VITE_API_TARGET_URL || window.location.origin;
  if (!configuredBase.includes('localhost')) {
    return configuredBase;
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocalHost ? configuredBase : window.location.origin;
};

export const getDisplayUrl = (
  relativePath: string | undefined | null,
  forceRefresh: boolean = false
): string => {
  if (!relativePath) {
    return '/placeholder.svg';
  }

  if (FULL_URL_PATTERN.test(relativePath)) {
    return forceRefresh ? withCacheBust(relativePath) : relativePath;
  }

  const base = getEffectiveBaseUrl().replace(/\/$/, '');
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const resolvedUrl = `${base}${normalizedPath}`;

  if (forceRefresh || (relativePath.includes('flipped_') && !relativePath.includes('?t='))) {
    return withCacheBust(resolvedUrl);
  }

  return resolvedUrl;
};

export const stripQueryParameters = (url: string | undefined | null): string => {
  if (!url) return '';
  const questionMarkIndex = url.indexOf('?');
  if (questionMarkIndex === -1) return url;
  return url.substring(0, questionMarkIndex);
};

export function formatTime(
  seconds: number,
  options: { showMilliseconds?: boolean; millisecondsDigits?: 1 | 2 | 3 } = {}
): string {
  const { showMilliseconds = false, millisecondsDigits = 1 } = options;

  if (!Number.isFinite(seconds) || seconds < 0) {
    return showMilliseconds ? '0:00.0' : '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const base = `${mins}:${secs.toString().padStart(2, '0')}`;

  if (!showMilliseconds) {
    return base;
  }

  const divisor = Math.pow(10, 3 - millisecondsDigits);
  const ms = Math.floor((seconds % 1) * 1000 / divisor);
  return `${base}.${ms.toString().padStart(millisecondsDigits, '0')}`;
}
