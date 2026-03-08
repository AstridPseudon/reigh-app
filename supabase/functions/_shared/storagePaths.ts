/** Shared storage path helpers for edge functions. */
export function generateUniqueFilename(extension: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomStr}.${extension}`;
}

export function generateThumbnailFilename(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `thumb_${timestamp}_${randomStr}.jpg`;
}

export function getFileExtension(
  filename: string,
  mimeType?: string,
  defaultExt: string = 'bin'
): string {
  const cleanName = filename
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .pop() ?? filename;
  const dotIndex = cleanName.lastIndexOf('.');
  if (dotIndex > 0 && dotIndex < cleanName.length - 1) {
    return cleanName.slice(dotIndex + 1).toLowerCase();
  }
  
  if (mimeType) {
    const mimeExt = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg');
    if (mimeExt) return mimeExt;
  }
  
  return defaultExt;
}

export const storagePaths = {
  upload: (userId: string, filename: string): string => 
    `${userId}/uploads/${filename}`,
  thumbnail: (userId: string, filename: string): string => 
    `${userId}/thumbnails/${filename}`,
  taskOutput: (userId: string, taskId: string, filename: string): string => 
    `${userId}/tasks/${taskId}/${filename}`,
  taskThumbnail: (userId: string, taskId: string, filename: string): string => 
    `${userId}/tasks/${taskId}/thumbnails/${filename}`,
};

export const MEDIA_BUCKET = 'image_uploads';



