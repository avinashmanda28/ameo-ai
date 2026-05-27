import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const order = await db.order.findUnique({
      where: { id: (await params).id },
      include: {
        store: { select: { id: true, name: true, platform: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const order = await db.order.update({ where: { id: (await params).id }, data: body });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    );
  }
}
