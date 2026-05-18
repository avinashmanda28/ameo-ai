import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/coordination — List agent coordination records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const status = searchParams.get('status') || undefined;
    const taskType = searchParams.get('taskType') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;

    const [coordinations, total] = await Promise.all([
      db.agentCoordination.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      db.agentCoordination.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: coordinations,
      meta: { total },
    });
  } catch (error) {
    console.error('[GET /api/coordination]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coordination records' },
      { status: 500 }
    );
  }
}

// POST /api/coordination — Create or update a coordination record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, taskId, taskType, description, ownerAgentId, ownerAgentType, authorityScope, permissionSet, priority, status, action } = body;

    if (!workspaceId || !taskId || !ownerAgentId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, taskId, and ownerAgentId are required' },
        { status: 400 }
      );
    }

    // If action is provided, update existing record
    if (action === 'complete') {
      const updated = await db.agentCoordination.updateMany({
        where: { taskId },
        data: { status: 'completed', completedAt: new Date() },
      });
      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'Coordination record not found' }, { status: 404 });
      }
      const record = await db.agentCoordination.findFirst({ where: { taskId } });
      return NextResponse.json({ success: true, data: record });
    }

    if (action === 'fail') {
      const updated = await db.agentCoordination.updateMany({
        where: { taskId },
        data: { status: 'failed', completedAt: new Date() },
      });
      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'Coordination record not found' }, { status: 404 });
      }
      const record = await db.agentCoordination.findFirst({ where: { taskId } });
      return NextResponse.json({ success: true, data: record });
    }

    // Upsert: create or update
    const record = await db.agentCoordination.upsert({
      where: { taskId },
      create: {
        workspaceId,
        taskId,
        taskType: taskType || 'build',
        description: description || null,
        ownerAgentId,
        ownerAgentType: ownerAgentType || null,
        authorityScope: typeof authorityScope === 'string' ? authorityScope : JSON.stringify(authorityScope || null),
        permissionSet: typeof permissionSet === 'string' ? permissionSet : JSON.stringify(permissionSet || null),
        status: status || 'claimed',
        priority: typeof priority === 'number' ? priority : 0,
      },
      update: {
        taskType: taskType || undefined,
        description: description || undefined,
        ownerAgentId: ownerAgentId || undefined,
        ownerAgentType: ownerAgentType || undefined,
        status: status || undefined,
        priority: typeof priority === 'number' ? priority : undefined,
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[POST /api/coordination]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process coordination' },
      { status: 500 }
    );
  }
}
