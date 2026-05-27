import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const status = searchParams.get('status') || undefined;
    const storeId = searchParams.get('storeId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          store: { select: { id: true, name: true } },
          items: true,
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: orders, total, limit, offset });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', storeId, orderNumber, customerName, customerEmail, total, currency, items, shippingAddress } = body;

    if (!total || !items?.length) {
      return NextResponse.json({ success: false, error: 'Total and items are required' }, { status: 400 });
    }

    const sa = getStoreAutomation();
    const result = await sa.recordOrder({
      workspaceId, storeId, orderNumber, customerName, customerEmail, total, currency, items, shippingAddress,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
