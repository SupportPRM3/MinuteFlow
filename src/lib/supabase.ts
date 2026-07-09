import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — uses anon key, safe to expose.
// Uses @supabase/ssr's cookie-based session storage (not localStorage) so the
// session is visible to middleware and server components, not just the browser.
export const supabase = createBrowserClient(url, anon);
