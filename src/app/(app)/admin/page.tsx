'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SystemConfig } from '@/types';
import { CONFIG_MANIFEST } from '@/lib/config/manifest';
import ConfigEditor from '@/components/admin/ConfigEditor';

export default function AdminPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [briefGenerating, setBriefGenerating] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load configuration');
      const data = await res.json();
      // The API returns { config, manifest } where manifest items have enriched metadata.
      // We transform manifest items into SystemConfig-compatible objects for ConfigEditor.
      const configEntries: SystemConfig[] = (data.manifest ?? []).map(
        (item: { key: string; current_value: string | number | boolean; group: string; label: string; description: string; type: string }) => ({
          key: item.key,
          value: String(item.current_value),
          group: item.group,
          label: item.label,
          description: item.description,
          type: item.type,
          validation: null,
          updated_at: new Date().toISOString(),
        })
      );
      setConfigs(configEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSave = useCallback(
    async (key: string, value: string) => {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) throw new Error('Failed to save');

      // Update local state
      setConfigs((prev) =>
        prev.map((c) =>
          c.key === key ? { ...c, value, updated_at: new Date().toISOString() } : c
        )
      );
    },
    []
  );

  const handleRunScanner = async () => {
    setScannerRunning(true);
    try {
      await fetch('/api/scanner/run', { method: 'POST' });
    } catch {
      // silent
    } finally {
      setScannerRunning(false);
    }
  };

  const handleGenerateBrief = async () => {
    setBriefGenerating(true);
    try {
      await fetch('/api/brief', { method: 'POST' });
    } catch {
      // silent
    } finally {
      setBriefGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-mata-text tracking-tight">
            aiMATA Admin
          </h1>
          <p className="text-sm text-mata-text-muted mt-0.5">
            Configure scoring, basket rules, and system parameters
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateBrief}
            disabled={briefGenerating}
            className="flex items-center gap-2 rounded-xl border border-mata-border bg-mata-surface px-4 py-2.5 text-sm font-bold text-mata-text-secondary transition-all hover:bg-mata-border hover:text-mata-text active:scale-[0.97] disabled:opacity-50"
          >
            {briefGenerating ? (
              <>
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
                Generating...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Generate Brief
              </>
            )}
          </button>

          <button
            onClick={handleRunScanner}
            disabled={scannerRunning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.97] disabled:opacity-50"
          >
            {scannerRunning ? (
              <>
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
                Scanning...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Run Scanner
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-mata-border bg-mata-card overflow-hidden"
            >
              <div className="border-b border-mata-border bg-mata-surface/50 px-5 py-3">
                <div className="h-4 w-24 rounded bg-mata-surface" />
              </div>
              <div className="p-5 space-y-5">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 w-32 rounded bg-mata-surface" />
                    <div className="h-3 w-48 rounded bg-mata-surface" />
                    <div className="h-10 w-full max-w-xs rounded-lg bg-mata-surface" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-mata-border bg-mata-card py-16">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mata-red/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-mata-red"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-mata-text">{error}</p>
          <button
            onClick={fetchConfigs}
            className="mt-4 rounded-xl bg-mata-surface px-5 py-2 text-sm font-semibold text-mata-text-secondary hover:bg-mata-border transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <ConfigEditor
          configs={configs}
          manifest={CONFIG_MANIFEST}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
