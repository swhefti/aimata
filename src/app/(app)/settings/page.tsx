'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type RiskTolerance = 'low' | 'medium' | 'high';

const RISK_OPTIONS: { value: RiskTolerance; label: string; description: string }[] = [
  {
    value: 'low',
    label: 'Low',
    description: 'Conservative approach. Prioritize capital preservation.',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced risk/reward. Mix of safe and aggressive plays.',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Aggressive. Maximize upside potential, accept higher drawdowns.',
  },
];

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('medium');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setDisplayName(
            user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              ''
          );
          setRiskTolerance(
            user.user_metadata?.risk_tolerance || 'medium'
          );
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          risk_tolerance: riskTolerance,
        },
      });

      if (updateError) throw updateError;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-black text-mata-text tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-mata-text-muted mt-0.5">
            Manage your profile and preferences
          </p>
        </div>
        <div className="animate-pulse rounded-2xl border border-mata-border bg-mata-card p-6 space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-mata-surface" />
            <div className="h-10 w-full rounded-xl bg-mata-surface" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-mata-surface" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 w-full rounded-xl bg-mata-surface" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-mata-text tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-mata-text-muted mt-0.5">
          Manage your profile and preferences
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-mata-border bg-mata-card p-6 space-y-6"
      >
        {/* Display name */}
        <div>
          <label
            htmlFor="displayName"
            className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-2"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-3 text-sm text-mata-text placeholder:text-mata-text-muted/50 focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20 transition-all"
          />
        </div>

        {/* Risk tolerance */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-3">
            Risk Tolerance
          </span>
          <div className="space-y-2">
            {RISK_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                  riskTolerance === option.value
                    ? 'border-mata-orange bg-mata-orange/5'
                    : 'border-mata-border bg-mata-surface/50 hover:bg-mata-surface'
                }`}
              >
                <input
                  type="radio"
                  name="riskTolerance"
                  value={option.value}
                  checked={riskTolerance === option.value}
                  onChange={(e) =>
                    setRiskTolerance(e.target.value as RiskTolerance)
                  }
                  className="mt-0.5 h-4 w-4 accent-mata-orange"
                />
                <div>
                  <span className="text-sm font-bold text-mata-text">
                    {option.label}
                  </span>
                  <p className="text-xs text-mata-text-muted mt-0.5">
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-mata-red/10 border border-mata-red/20 px-4 py-3 text-xs font-medium text-mata-red">
            {error}
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-6 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-mata-green">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
