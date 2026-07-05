import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for client components. Uses cookie storage (via
 * @supabase/ssr) so the server can read the same session — this is what makes
 * the PKCE magic-link flow work across the browser→server hop.
 *
 * Returns null when Supabase isn't configured (keeps the app usable locally
 * before keys are set).
 */
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createBrowserClient(url, anon);
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
