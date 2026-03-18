import type { SupabaseClient } from '@supabase/supabase-js';
import { getDefaultConfig, getManifestItem } from './manifest';

export type RuntimeConfig = Record<string, string | number | boolean>;

/**
 * Loads all config values from the trader.system_config table,
 * merging with manifest defaults for any missing keys.
 */
export async function loadConfig(supabase: SupabaseClient): Promise<RuntimeConfig> {
  const defaults = getDefaultConfig();

  const { data, error } = await supabase
    .schema('trader')
    .from('system_config')
    .select('key, value, type');

  if (error) {
    console.warn('Failed to load config from Supabase, using defaults:', error.message);
    return defaults;
  }

  const config = { ...defaults };

  if (data) {
    for (const row of data as { key: string; value: string; type: string }[]) {
      config[row.key] = castValue(row.value, row.type);
    }
  }

  return config;
}

/**
 * Get a typed config value with proper casting.
 */
export function getConfigValue<T extends string | number | boolean>(
  config: RuntimeConfig,
  key: string
): T {
  const value = config[key];
  if (value === undefined) {
    const manifest = getManifestItem(key);
    if (manifest) {
      return manifest.default_value as T;
    }
    throw new Error(`Unknown config key: ${key}`);
  }
  return value as T;
}

/**
 * Save a single config value to the trader.system_config table.
 * Validates against the manifest before saving.
 */
export async function saveConfig(
  supabase: SupabaseClient,
  key: string,
  value: string | number | boolean
): Promise<{ success: boolean; error?: string }> {
  const manifest = getManifestItem(key);
  if (!manifest) {
    return { success: false, error: `Unknown config key: ${key}` };
  }

  // Validate type
  const validationError = validateConfigValue(key, value, manifest);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);

  const { error } = await supabase
    .schema('trader')
    .from('system_config')
    .upsert(
      {
        key,
        value: serialized,
        group: manifest.group,
        label: manifest.label,
        description: manifest.description,
        type: manifest.type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── Internal Helpers ───

function castValue(value: string, type: string): string | number | boolean {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'json':
      return value; // keep as string, consumer parses
    default:
      return value;
  }
}

function validateConfigValue(
  key: string,
  value: string | number | boolean,
  manifest: { type: string; validation: { min?: number; max?: number; options?: string[] } | null }
): string | null {
  // Type check
  if (manifest.type === 'number' && typeof value !== 'number') {
    return `${key} expects a number, got ${typeof value}`;
  }
  if (manifest.type === 'boolean' && typeof value !== 'boolean') {
    return `${key} expects a boolean, got ${typeof value}`;
  }
  if (manifest.type === 'string' && typeof value !== 'string') {
    return `${key} expects a string, got ${typeof value}`;
  }

  // Range validation
  if (manifest.validation) {
    if (typeof value === 'number') {
      if (manifest.validation.min !== undefined && value < manifest.validation.min) {
        return `${key} must be at least ${manifest.validation.min}`;
      }
      if (manifest.validation.max !== undefined && value > manifest.validation.max) {
        return `${key} must be at most ${manifest.validation.max}`;
      }
    }
    if (manifest.validation.options && typeof value === 'string') {
      if (!manifest.validation.options.includes(value)) {
        return `${key} must be one of: ${manifest.validation.options.join(', ')}`;
      }
    }
  }

  return null;
}
