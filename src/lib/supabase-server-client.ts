import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request, session-aware server client — reads the logged-in user from cookies.
// Use in Server Components, Route Handlers, and Server Actions.
// Do NOT use for privileged writes; that's what supabaseAdmin (supabase-server.ts) is for.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore since
            // middleware refreshes the session on every request anyway.
          }
        },
      },
    }
  );
}
