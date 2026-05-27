import { NextRequest, NextResponse } from 'next/server';
import { getProductIntelligence } from '@/lib/services/commerce/product-intelligence';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const pi = getProductIntelligence();
    const result = await pi.estimateProfit((await params).id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to estimate profit' },
      { status: 500 }
    );
  }
}
