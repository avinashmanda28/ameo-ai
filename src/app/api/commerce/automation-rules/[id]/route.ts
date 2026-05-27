import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rule = await db.automationRule.findUnique({
      where: { id: (await params).id },
      include: { store: { select: { id: true, name: true, platform: true } } },
    });
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch rule' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const rule = await db.automationRule.update({ where: { id: (await params).id }, data: body });
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await db.automationRule.delete({ where: { id: (await params).id } });
    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
