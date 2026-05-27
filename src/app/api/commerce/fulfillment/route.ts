// ─── AMEO AI — Fulfillment Engine API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { FulfillmentEngine } from '@/lib/services/commerce/fulfillment-engine';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const engine = new FulfillmentEngine(workspaceId);
    const stats = await engine.getStats();

    const recentOrders = await db.order.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: { stats, recentOrders } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch fulfillment data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const engine = new FulfillmentEngine(workspaceId);

    switch (action) {
      case 'fulfill': {
        const result = await engine.fulfillOrder(params);
        return NextResponse.json({ success: true, data: result });
      }
      case 'retry': {
        if (!params.orderId) {
          return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
        }
        const result = await engine.retryFailedFulfillment(params.orderId);
        return NextResponse.json({ success: true, data: result });
      }
      case 'refund': {
        const { orderId, reason, amount } = params;
        if (!orderId || !reason) {
          return NextResponse.json({ success: false, error: 'orderId and reason are required' }, { status: 400 });
        }
        const result = await engine.initiateRefund(orderId, reason, amount);
        return NextResponse.json({ success: true, data: result });
      }
      case 'shipment-update': {
        const result = await engine.updateShipment(params);
        return NextResponse.json({ success: true, data: result });
      }
      case 'sync-orders': {
        if (!params.storeId) {
          return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
        }
        const result = await engine.syncOrdersFromStore(params.storeId);
        return NextResponse.json({ success: true, data: result });
      }
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: fulfill, retry, refund, shipment-update, or sync-orders' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fulfillment operation failed' },
      { status: 500 }
    );
  }
}
