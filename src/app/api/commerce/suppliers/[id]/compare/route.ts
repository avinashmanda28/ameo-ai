import { NextRequest, NextResponse } from 'next/server';
import { getSupplierIntelligence } from '@/lib/services/commerce/supplier-intelligence';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', supplierIds = [] } = body;
    const allIds = [(await params).id, ...supplierIds];
    const si = getSupplierIntelligence();
    const result = await si.compareSuppliers(workspaceId, allIds);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to compare suppliers' },
      { status: 500 }
    );
  }
}
