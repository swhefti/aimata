import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig, saveConfig } from '@/lib/config/runtime';
import { CONFIG_MANIFEST } from '@/lib/config/manifest';

export async function GET() {
  try {
    const admin = createAdminClient();
    const config = await loadConfig(admin);

    // Return config merged with manifest metadata
    const enriched = CONFIG_MANIFEST.map((item) => ({
      ...item,
      current_value: config[item.key] ?? item.default_value,
    }));

    return NextResponse.json({ config, manifest: enriched });
  } catch (error) {
    console.error('Failed to load config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    if (value === undefined) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await saveConfig(admin, key, value);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return updated config
    const config = await loadConfig(admin);

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to save config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
