import { NextRequest, NextResponse } from 'next/server';
import { getTrendDiscovery } from '@/lib/services/commerce/trend-discovery';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const td = getTrendDiscovery();
    const result = await td.getTrendTimeline((await params).id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch trend timeline' },
      { status: 500 }
    );
  }
}
