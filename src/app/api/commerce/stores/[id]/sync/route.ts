import { NextRequest, NextResponse } from 'next/server';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { syncType = 'full' } = await req.json();
    const sa = getStoreAutomation();

    let result;
    switch (syncType) {
      case 'products':
        result = await sa.syncProducts((await params).id);
        break;
      case 'orders':
        result = await sa.syncOrders((await params).id);
        break;
      case 'inventory':
        result = await sa.syncInventory((await params).id);
        break;
      case 'pricing':
        result = await sa.syncPricing((await params).id);
        break;
      default:
        // Full sync: run all in sequence
        const results = await Promise.allSettled([
          sa.syncProducts((await params).id),
          sa.syncOrders((await params).id),
          sa.syncInventory((await params).id),
          sa.syncPricing((await params).id),
        ]);
        result = {
          storeId: (await params).id,
          storeName: '',
          syncType: 'full',
          status: results.some((r) => r.status === 'fulfilled') ? 'success' : 'failed',
          syncedCount: 0,
          errorCount: results.filter((r) => r.status === 'rejected').length,
          errors: results
            .filter((r) => r.status === 'rejected')
            .map((r) => (r as PromiseRejectedResult).reason?.message || 'Sync failed'),
          durationMs: 0,
        };
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync store' },
      { status: 500 }
    );
  }
}
