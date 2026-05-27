// ─── AMEO AI — Revenue Operations Dashboard API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { RevenueOperations } from '@/lib/services/commerce/revenue-operations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const dashboard = new RevenueOperations(workspaceId);
    const data = await dashboard.getDashboard();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const dashboard = new RevenueOperations(workspaceId);

    if (action === 'record-metric') {
      await dashboard.recordMetric({ ...params, workspaceId });
      return NextResponse.json({ success: true }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use: record-metric' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to record metric' },
      { status: 500 }
    );
  }
}
