import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const storeId = searchParams.get('storeId') || undefined;
    const type = searchParams.get('type') || undefined;
    const enabled = searchParams.get('enabled') === 'true' ? true : undefined;

    const where: Record<string, unknown> = { workspaceId };
    if (storeId) where.storeId = storeId;
    if (type) where.type = type;
    if (enabled !== undefined) where.enabled = enabled;

    const rules = await db.automationRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: rules, total: rules.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', storeId, name, type, description, conditions, actions, schedule, requiresApproval } = body;

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'Name and type are required' }, { status: 400 });
    }

    const rule = await db.automationRule.create({
      data: {
        workspaceId,
        storeId: storeId || null,
        name,
        type,
        description,
        conditions: conditions ? JSON.stringify(conditions) : null,
        actions: actions ? JSON.stringify(actions) : null,
        schedule: schedule || null,
        requiresApproval: requiresApproval || false,
        status: 'active',
        config: JSON.stringify({ version: '1.0' }),
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create rule' },
      { status: 500 }
    );
  }
}
