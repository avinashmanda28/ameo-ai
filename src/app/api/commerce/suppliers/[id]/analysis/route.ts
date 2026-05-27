import { NextRequest, NextResponse } from 'next/server';
import { getSupplierIntelligence } from '@/lib/services/commerce/supplier-intelligence';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const si = getSupplierIntelligence();
    const result = await si.analyzeSupplier((await params).id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to analyze supplier' },
      { status: 500 }
    );
  }
}
