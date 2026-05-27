import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const store = await db.store.findUnique({ where: { id: (await params).id } });
    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    const products = await db.product.findMany({
      where: { workspaceId: store.workspaceId, storeProductId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, data: products, total: products.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch store products' },
      { status: 500 }
    );
  }
}
