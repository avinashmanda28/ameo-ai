import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getStoreAutomation } from '@/lib/services/commerce/store-automation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = getStoreAutomation();
    const result = await sa.getStoreStatus((await params).id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch store' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const store = await db.store.update({ where: { id: (await params).id }, data: body });
    return NextResponse.json({ success: true, data: store });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update store' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = getStoreAutomation();
    await sa.disconnectStore((await params).id);
    return NextResponse.json({ success: true, message: 'Store disconnected' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to disconnect store' },
      { status: 500 }
    );
  }
}
