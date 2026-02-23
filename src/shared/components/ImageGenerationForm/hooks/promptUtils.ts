import { truncateText } from '@/shared/lib/stringFormatting';

/** Truncate a full prompt to a short display label (30 chars). */
export function toShortPrompt(fullPrompt: string): string {
  return truncateText(fullPrompt, 30);
}
