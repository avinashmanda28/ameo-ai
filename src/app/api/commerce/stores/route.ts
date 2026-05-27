import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const status = searchParams.get('status') || undefined;
    const platform = searchParams.get('platform') || undefined;

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    if (platform) where.platform = platform;

    const stores = await db.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true, rules: true } } },
    });

    return NextResponse.json({ success: true, data: stores, total: stores.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', name, platform, apiKey, apiSecret, accessToken, platformUrl, settings } = body;

    if (!name || !platform) {
      return NextResponse.json({ success: false, error: 'Store name and platform are required' }, { status: 400 });
    }

    const sa = getStoreAutomation();
    const result = await sa.connectStore(workspaceId, {
      name, platform, apiKey, apiSecret, accessToken, platformUrl, settings,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to connect store' },
      { status: 500 }
    );
  }
}
