// ─── AMEO AI — Integration Hub API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IntegrationHub } from '@/lib/services/commerce/integration-hub';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const provider = searchParams.get('provider') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: Record<string, unknown> = { workspaceId };
    if (provider) where.provider = provider;
    if (status) where.connectionStatus = status;

    const integrations = await db.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: integrations, total: integrations.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', provider, name, config, apiKey, apiSecret, accessToken } = body;

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider is required' }, { status: 400 });
    }

    const hub = new IntegrationHub(workspaceId);
    const integration = await hub.createIntegration({
      provider,
      name: name || provider,
      config: config || {},
      apiKey,
      apiSecret,
    });

    try {
      await hub.connect(integration.id, { accessToken });
    } catch {
      // Connection will be retried — integration is saved
    }

    return NextResponse.json({ success: true, data: integration }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to connect integration' },
      { status: 500 }
    );
  }
}
