/**
 * Stable entrypoint for public Supabase database schema types.
 *
 * Keep the generated `types.ts` file internal to integration code; app/domain
 * layers should import from this module instead.
 */
export type { Database } from '@/integrations/supabase/types';
