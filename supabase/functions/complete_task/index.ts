// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { completeTaskHandler } from './handler.ts';

export { completeTaskHandler };

if ((import.meta as unknown as { main?: boolean }).main) {
  serve((req) => {
    return completeTaskHandler(req);
  });
}
