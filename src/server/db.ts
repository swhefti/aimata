/**
 * Centralized Supabase client creation for server-side domain services.
 *
 * All domain modules should import clients from here, not from lib/supabase/*.
 * This is the single place that knows about env vars and client configuration.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Admin client — bypasses RLS. For server-side service operations only.
 * Used by pipeline workers, scanner, admin config, and domain services
 * that operate across users or on shared data.
 */
export function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Authenticated server client — respects RLS, tied to current user session.
 * Used by domain services that need to know who the caller is.
 */
export async function getAuthClient() {
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
            // Server Component context — cookie writes are ignored
          }
        },
      },
    }
  );
}

/**
 * Get the authenticated user from the current request.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await getAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Get the authenticated user, throw if not authenticated.
 * For use in domain services that require auth.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Unauthorized');
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
