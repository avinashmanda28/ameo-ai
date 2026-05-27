import { NextRequest, NextResponse } from 'next/server';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { trackingNumber, trackingUrl, carrier } = await req.json();
    const sa = getStoreAutomation();

    const orderId = (await params).id;
    await sa.fulfillOrder(orderId, { orderId, trackingNumber, trackingUrl, carrier });

    return NextResponse.json({ success: true, message: 'Order fulfilled' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fulfill order' },
      { status: 500 }
    );
  }
}
