'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  // Use the current origin so magic links always redirect back to THIS app
  const siteUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aimata.vercel.app';

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogleSignIn() {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (err) {
      setError(err.message);
    }
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
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6 shadow-xl shadow-black/20">
          {sent ? (
            /* Success state */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mata-green/10 text-2xl">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-mata-green"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-black text-mata-text">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-mata-text-muted leading-relaxed">
                We sent a magic link to{' '}
                <span className="font-semibold text-mata-text-secondary">
                  {email}
                </span>
                . Click the link to sign in.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="mt-5 text-xs font-semibold text-mata-orange hover:text-mata-orange-dark transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Magic Link Form */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted"
                >
                  Email address
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
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="opacity-25"
                        />
                        <path
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          fill="currentColor"
                          className="opacity-75"
                        />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Magic Link'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-mata-border" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-mata-text-muted">
                  or
                </span>
                <div className="h-px flex-1 bg-mata-border" />
              </div>

              {/* Google Sign-in */}
              <button
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm font-semibold text-mata-text transition-all hover:bg-mata-border hover:border-mata-text-muted/30 active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            </>
          )}

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
