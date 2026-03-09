import path from 'node:path';

const HTTPS_SCHEME = 'https';
const DENO_LAND_HOST = 'deno.land';
const ESM_SH_HOST = 'esm.sh';

const DENO_LAND_BASE = `${HTTPS_SCHEME}://${DENO_LAND_HOST}`;
const ESM_SH_BASE = `${HTTPS_SCHEME}://${ESM_SH_HOST}`;

export function buildEdgeAliasMap(mocksDir: string): Record<string, string> {
  return {
    [`${DENO_LAND_BASE}/std@0.224.0/http/server.ts`]: path.resolve(
      mocksDir,
      'denoHttpServer.ts',
    ),
    [`${DENO_LAND_BASE}/std@0.177.0/http/server.ts`]: path.resolve(
      mocksDir,
      'denoHttpServer.ts',
    ),
    [`${DENO_LAND_BASE}/std@0.168.0/http/server.ts`]: path.resolve(
      mocksDir,
      'denoHttpServer.ts',
    ),
    [`${DENO_LAND_BASE}/std@0.177.0/crypto/mod.ts`]: path.resolve(
      mocksDir,
      'denoCrypto.ts',
    ),
    [`${ESM_SH_BASE}/@supabase/supabase-js@2.39.7`]: path.resolve(
      mocksDir,
      'supabaseClient.ts',
    ),
    [`${ESM_SH_BASE}/@supabase/supabase-js@2`]: path.resolve(
      mocksDir,
      'supabaseClient.ts',
    ),
    'npm:@supabase/supabase-js@2': path.resolve(
      mocksDir,
      'supabaseClient.ts',
    ),
    [`${ESM_SH_BASE}/stripe@12.18.0?target=deno`]: path.resolve(
      mocksDir,
      'stripe.ts',
    ),
    [`${ESM_SH_BASE}/@huggingface/hub@0.18.2`]: path.resolve(
      mocksDir,
      'huggingfaceHub.ts',
    ),
  };
}
