import { NextResponse } from 'next/server';
import { getAdminClient } from '@/server/db';
import { loadConfig, saveConfig } from '@/lib/config/runtime';
import { CONFIG_MANIFEST } from '@/lib/config/manifest';

export async function GET() {
  try {
    const admin = getAdminClient();
    const config = await loadConfig(admin);

    const enriched = CONFIG_MANIFEST.map((item) => ({
      ...item,
      current_value: config[item.key] ?? item.default_value,
    }));

    return NextResponse.json({ config, manifest: enriched });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
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

    const admin = getAdminClient();
    const result = await saveConfig(admin, key, value);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const config = await loadConfig(admin);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
