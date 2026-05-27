import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTrendDiscovery } from '@/lib/services/commerce/trend-discovery';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const signals = await db.trendSignal.findMany({
      where: { trendId: (await params).id },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ success: true, data: signals, count: signals.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId = 'default', source, keywords, interval } = await req.json();
    const td = getTrendDiscovery();
    const count = await td.collectSignals(workspaceId, source || 'manual', keywords || [], interval || 'day');
    return NextResponse.json({ success: true, data: { signalsCollected: count } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to collect signals' },
      { status: 500 }
    );
  }
}
