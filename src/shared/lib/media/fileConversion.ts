import {
  operationFailure,
  operationSuccess,
  type OperationResult,
} from '@/shared/lib/operationResult';

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
  fileType?: string,
): OperationResult<File> => {
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

    return operationSuccess(new File([bytes], filename, { type: mimeType }));
  } catch (error) {
    return operationFailure(error, {
      policy: 'fail_closed',
      errorCode: 'data_url_file_conversion_failed',
      message: 'Failed to convert data URL to file',
      recoverable: false,
      cause: {
        filename,
        ...(fileType ? { fileType } : {}),
      },
    });
  }
};
