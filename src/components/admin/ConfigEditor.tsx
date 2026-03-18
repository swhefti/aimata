'use client';

import { useState, useMemo, useCallback } from 'react';
import type { SystemConfig } from '@/types';
import type { ConfigManifestItem } from '@/lib/config/manifest';

interface ConfigEditorProps {
  configs: SystemConfig[];
  manifest: ConfigManifestItem[];
  onSave: (key: string, value: string) => Promise<void>;
}

const GROUP_LABELS: Record<string, string> = {
  scanner: 'Scanner',
  scoring: 'Scoring Weights',
  basket: 'Basket Rules',
  probability: 'Probability Engine',
  prompts: 'Prompts',
  model: 'AI Model',
};

const GROUP_ORDER = ['scanner', 'scoring', 'basket', 'probability', 'model', 'prompts'];

interface FieldState {
  value: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

function ConfigField({
  config,
  manifestItem,
  onSave,
}: {
  config: SystemConfig;
  manifestItem: ConfigManifestItem | undefined;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [state, setState] = useState<FieldState>({
    value: config.value,
    saving: false,
    saved: false,
    error: null,
  });

  const isDirty = state.value !== config.value;

  const validate = useCallback(
    (val: string): string | null => {
      if (!manifestItem?.validation) return null;
      const v = manifestItem.validation;

      if (config.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num)) return 'Must be a valid number';
        if (v.min !== undefined && num < v.min) return `Min: ${v.min}`;
        if (v.max !== undefined && num > v.max) return `Max: ${v.max}`;
      }

      if (v.options && !v.options.includes(val)) {
        return `Must be one of: ${v.options.join(', ')}`;
      }

      return null;
    },
    [config.type, manifestItem]
  );

  const handleSave = async () => {
    const err = validate(state.value);
    if (err) {
      setState((s) => ({ ...s, error: err }));
      return;
    }

    setState((s) => ({ ...s, saving: true, error: null }));
    try {
      await onSave(config.key, state.value);
      setState((s) => ({ ...s, saving: false, saved: true }));
      setTimeout(() => setState((s) => ({ ...s, saved: false })), 2000);
    } catch {
      setState((s) => ({
        ...s,
        saving: false,
        error: 'Failed to save. Please try again.',
      }));
    }
  };

  const handleChange = (val: string) => {
    setState({ value: val, saving: false, saved: false, error: null });
  };

  const isPrompt = config.type === 'string' && config.key.startsWith('prompts.');
  const isBoolean = config.type === 'boolean';
  const hasOptions = manifestItem?.validation?.options;

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-bold text-mata-text block">
            {config.label}
          </label>
          <p className="text-xs text-mata-text-muted mt-0.5">{config.description}</p>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-2">
        <div className="flex-1">
          {isBoolean ? (
            <button
              onClick={() =>
                handleChange(state.value === 'true' ? 'false' : 'true')
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                state.value === 'true' ? 'bg-mata-orange' : 'bg-mata-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  state.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          ) : hasOptions ? (
            <select
              value={state.value}
              onChange={(e) => handleChange(e.target.value)}
              className="rounded-lg border border-mata-border bg-mata-surface px-3 py-2 text-sm text-mata-text focus:border-mata-orange focus:outline-none focus:ring-1 focus:ring-mata-orange/30"
            >
              {hasOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : isPrompt ? (
            <textarea
              value={state.value}
              onChange={(e) => handleChange(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-mata-border bg-mata-surface px-3 py-2 text-sm text-mata-text font-mono resize-y focus:border-mata-orange focus:outline-none focus:ring-1 focus:ring-mata-orange/30"
            />
          ) : (
            <input
              type={config.type === 'number' ? 'number' : 'text'}
              value={state.value}
              onChange={(e) => handleChange(e.target.value)}
              step={
                config.type === 'number'
                  ? manifestItem?.validation?.max !== undefined &&
                    manifestItem.validation.max <= 1
                    ? 0.01
                    : 1
                  : undefined
              }
              min={manifestItem?.validation?.min}
              max={manifestItem?.validation?.max}
              className="w-full max-w-xs rounded-lg border border-mata-border bg-mata-surface px-3 py-2 text-sm text-mata-text focus:border-mata-orange focus:outline-none focus:ring-1 focus:ring-mata-orange/30"
            />
          )}
        </div>

        {isDirty && (
          <button
            onClick={handleSave}
            disabled={state.saving}
            className="rounded-lg bg-mata-orange px-3 py-2 text-xs font-bold text-white transition-all hover:bg-mata-orange-dark active:scale-95 disabled:opacity-50 shrink-0"
          >
            {state.saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {state.saved && (
          <span className="text-xs font-bold text-mata-green py-2 shrink-0">
            Saved
          </span>
        )}
      </div>

      {state.error && (
        <p className="mt-1.5 text-xs font-medium text-mata-red">{state.error}</p>
      )}
    </div>
  );
}

export default function ConfigEditor({
  configs,
  manifest,
  onSave,
}: ConfigEditorProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, { config: SystemConfig; manifest?: ConfigManifestItem }[]> = {};

    for (const config of configs) {
      const group = config.group || 'other';
      if (!groups[group]) groups[group] = [];
      const mi = manifest.find((m) => m.key === config.key);
      groups[group].push({ config, manifest: mi });
    }

    return groups;
  }, [configs, manifest]);

  const sortedGroups = useMemo(() => {
    return GROUP_ORDER.filter((g) => grouped[g]).concat(
      Object.keys(grouped).filter((g) => !GROUP_ORDER.includes(g))
    );
  }, [grouped]);

  return (
    <div className="space-y-6">
      {sortedGroups.map((groupKey) => (
        <div
          key={groupKey}
          className="rounded-2xl border border-mata-border bg-mata-card overflow-hidden"
        >
          <div className="border-b border-mata-border bg-mata-surface/50 px-5 py-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-mata-text">
              {GROUP_LABELS[groupKey] || groupKey}
            </h3>
          </div>

          <div className="divide-y divide-mata-border/50 px-5 py-3">
            {grouped[groupKey].map(({ config, manifest: mi }) => (
              <ConfigField
                key={config.key}
                config={config}
                manifestItem={mi}
                onSave={onSave}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
