import { NextRequest, NextResponse } from 'next/server';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { productId, price, comparePrice, syncInventory } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const storeId = (await params).id;
    const sa = getStoreAutomation();
    const result = await sa.importProduct(storeId, { storeId, productId, price, comparePrice, syncInventory });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to import product' },
      { status: 500 }
    );
  }
}
