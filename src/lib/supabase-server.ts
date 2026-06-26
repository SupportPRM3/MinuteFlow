import { createClient } from "@supabase/supabase-js";

// Server-only client — uses service role key, never import from client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
