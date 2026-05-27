import { NextRequest, NextResponse } from 'next/server';
import { getCommerceAnalytics } from '@/lib/services/commerce/commerce-analytics';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const ca = getCommerceAnalytics();
    const metrics = await ca.getFulfillmentMetrics(workspaceId);

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch fulfillment metrics' },
      { status: 500 }
    );
  }
}
