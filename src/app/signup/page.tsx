'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || password.length < 8) return;

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() || undefined },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    // If user is immediately confirmed (e.g., email confirmations disabled)
    if (data.session) {
      router.push('/dashboard');
      return;
    }

    // Otherwise show confirmation message
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-mata-bg via-mata-bg to-mata-surface/30 px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" showSubtitle={false} />
          </div>
          <div className="rounded-2xl border border-mata-border bg-mata-card p-6 shadow-xl shadow-black/5 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mata-green/10 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mata-green">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-mata-text">Check your email</h2>
            <p className="mt-2 text-sm text-mata-text-muted leading-relaxed">
              We sent a confirmation link to{' '}
              <span className="font-semibold text-mata-text-secondary">{email}</span>.
              Click the link to activate your account.
            </p>
            <Link href="/login" className="mt-5 inline-block text-xs font-semibold text-mata-orange hover:text-mata-orange-dark transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-mata-bg via-mata-bg to-mata-surface/30 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" showSubtitle={false} />
          <p className="mt-4 text-sm font-medium text-mata-text-secondary text-center leading-relaxed">
            Create your aiMATA account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6 shadow-xl shadow-black/5">
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-1">
                Display Name <span className="text-mata-text-muted/50">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm text-mata-text placeholder:text-mata-text-muted/50 focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20 transition-all"
              />
            </div>

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
                Password <span className="text-mata-text-muted/50">(min 8 characters)</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={8}
                className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm text-mata-text placeholder:text-mata-text-muted/50 focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || password.length < 8}
              className="w-full rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-4 text-center">
            <p className="text-xs text-mata-text-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-mata-orange hover:text-mata-orange-dark transition-colors">
                Sign In
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-mata-red/10 border border-mata-red/20 px-4 py-3 text-xs font-medium text-mata-red">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
