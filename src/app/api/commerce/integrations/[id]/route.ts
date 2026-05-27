// ─── AMEO AI — Single Integration API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { IntegrationHub } from '@/lib/services/commerce/integration-hub';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const { id } = await params;

    const integration = await db.integration.findFirst({
      where: { id, workspaceId },
    });

    if (!integration) {
      return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: integration });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const { id } = await params;

    const integration = await db.integration.findFirst({
      where: { id, workspaceId },
    });
    if (!integration) {
      return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 });
    }

    const updated = await db.integration.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const { id } = await params;

    const integration = await db.integration.findFirst({
      where: { id, workspaceId },
    });
    if (!integration) {
      return NextResponse.json({ success: false, error: 'Integration not found' }, { status: 404 });
    }

    const hub = new IntegrationHub(workspaceId);
    await hub.disconnect(id);

    return NextResponse.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const action = searchParams.get('action') || body.action;
    const { id } = await params;

    const hub = new IntegrationHub(workspaceId);

    if (action === 'sync') {
      const resource = body.resource || 'all';
      const result = await hub.sync(id, resource);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'healthcheck') {
      const health = await hub.checkHealth(id);
      return NextResponse.json({ success: true, data: health });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}
