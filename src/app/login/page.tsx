'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      const onboarded = typeof window !== 'undefined' && localStorage.getItem('aimata_onboarded');
      router.push(onboarded ? '/dashboard' : '/onboarding');
    }
  }

  async function handleGuestEntry() {
    setGuestLoading(true);
    setError(null);

    // Sign in with a shared guest account
    const { error: err } = await supabase.auth.signInWithPassword({
      email: 'guest@aimata.app',
      password: 'guest-access-2026',
    });

    if (err) {
      // If guest account doesn't exist, create it
      const { error: signUpErr } = await supabase.auth.signUp({
        email: 'guest@aimata.app',
        password: 'guest-access-2026',
        options: {
          data: { display_name: 'Guest' },
        },
      });

      if (signUpErr) {
        setError('Guest access is temporarily unavailable.');
        setGuestLoading(false);
        return;
      }

      // Try signing in again after creation
      const { error: retryErr } = await supabase.auth.signInWithPassword({
        email: 'guest@aimata.app',
        password: 'guest-access-2026',
      });

      if (retryErr) {
        setError('Guest access is temporarily unavailable.');
        setGuestLoading(false);
        return;
      }
    }

    setGuestLoading(false);
    const onboarded = typeof window !== 'undefined' && localStorage.getItem('aimata_onboarded');
    router.push(onboarded ? '/dashboard' : '/onboarding');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-mata-bg via-mata-bg to-mata-surface/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showSubtitle={false} />
          <p className="mt-4 text-sm font-medium text-mata-text-secondary text-center leading-relaxed">
            Trade the move. See the risk. Build the basket.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6 shadow-xl shadow-black/5">
          {/* Sign In Form */}
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm text-mata-text placeholder:text-mata-text-muted/50 focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                minLength={8}
                className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm text-mata-text placeholder:text-mata-text-muted/50 focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up link */}
          <div className="mt-4 text-center">
            <p className="text-xs text-mata-text-muted">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-bold text-mata-orange hover:text-mata-orange-dark transition-colors">
                Sign Up
              </Link>
            </p>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-mata-border" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-mata-text-muted">or</span>
            <div className="h-px flex-1 bg-mata-border" />
          </div>

          {/* Guest Entry */}
          <button
            onClick={handleGuestEntry}
            disabled={guestLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm font-semibold text-mata-text transition-all hover:bg-mata-border hover:border-mata-text-muted/30 active:scale-[0.98] disabled:opacity-50"
          >
            {guestLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
                Entering...
              </span>
            ) : (
              'Enter as Guest'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-mata-red/10 border border-mata-red/20 px-4 py-3 text-xs font-medium text-mata-red">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-mata-text-muted/60">
          By signing in, you agree to use aiMATA responsibly.
        </p>
      </div>
    </div>
  );
}
