import { getSupabaseClient as supabase } from '@/integrations/supabase/client';

export interface HuggingFaceUploadResponse {
  success: boolean;
  error?: string;
  repoId?: string;
  repoUrl?: string;
  loraUrl?: string;
  highNoiseUrl?: string;
  lowNoiseUrl?: string;
  videoUrls?: string[];
}

export async function fetchAuthenticatedUserId(): Promise<string | null> {
  const { data: { user } } = await supabase().auth.getUser();
  return user?.id ?? null;
}

export async function uploadTemporaryFile(file: File, userId: string): Promise<string> {
  const fileName = `${crypto.randomUUID()}-${file.name}`;
  const filePath = `${userId}/${fileName}`;
  const { error } = await supabase().storage
    .from('temporary')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return filePath;
}

export async function invokeHuggingFaceUploadFunction(
  formData: FormData,
): Promise<HuggingFaceUploadResponse> {
  const { data, error } = await supabase().functions.invoke('huggingface-upload', {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || 'Edge function error');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Upload failed');
  }

  return data as HuggingFaceUploadResponse;
}
