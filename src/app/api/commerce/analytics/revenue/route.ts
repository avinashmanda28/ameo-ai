import { NextRequest, NextResponse } from 'next/server';
import { getCommerceAnalytics } from '@/lib/services/commerce/commerce-analytics';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const period = (searchParams.get('period') || 'monthly') as 'daily' | 'weekly' | 'monthly' | 'yearly';

    const ca = getCommerceAnalytics();
    const analytics = await ca.getRevenueAnalytics(workspaceId, period);

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}
