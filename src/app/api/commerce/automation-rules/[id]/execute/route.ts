import { NextRequest, NextResponse } from 'next/server';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = getStoreAutomation();
    const result = await sa.executeRule((await params).id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to execute rule' },
      { status: 500 }
    );
  }
}
