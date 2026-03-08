import type { Json } from '@/integrations/supabase/jsonTypes';

export function toJsonObject(value: unknown): Record<string, Json | undefined> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }
  return {};
}
