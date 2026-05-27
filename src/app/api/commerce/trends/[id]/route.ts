import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const trend = await db.trend.findUnique({
      where: { id: (await params).id },
      include: {
        product: { select: { id: true, name: true, overallScore: true } },
        signals: { orderBy: { recordedAt: 'desc' }, take: 50 },
        _count: { select: { signals: true } },
      },
    });
    if (!trend) {
      return NextResponse.json({ success: false, error: 'Trend not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: trend });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch trend' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const trend = await db.trend.update({ where: { id: (await params).id }, data: body });
    return NextResponse.json({ success: true, data: trend });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update trend' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await db.trend.delete({ where: { id: (await params).id } });
    return NextResponse.json({ success: true, message: 'Trend deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete trend' },
      { status: 500 }
    );
  }
}
