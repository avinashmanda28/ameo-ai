import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/traces — List execution traces, optionally grouped by traceId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const traceId = searchParams.get('traceId') || undefined;
    const subsystem = searchParams.get('subsystem') || undefined;
    const status = searchParams.get('status') || undefined;
    const grouped = searchParams.get('grouped') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (traceId) where.traceId = traceId;
    if (subsystem) where.subsystem = subsystem;
    if (status) where.status = status;

    if (grouped) {
      // Get distinct traceIds first, then fetch all steps
      const distinctTraces = await db.executionTrace.findMany({
        where,
        select: { traceId: true },
        distinct: ['traceId'],
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const traceIds = distinctTraces.map((t) => t.traceId);
      if (traceIds.length === 0) {
        return NextResponse.json({ success: true, data: [], meta: { total: 0 } });
      }

      const traces = await db.executionTrace.findMany({
        where: { traceId: { in: traceIds } },
        orderBy: [{ traceId: 'desc' }, { stepOrder: 'asc' }],
      });

      const total = await db.executionTrace.groupBy({
        by: ['traceId'],
        where: workspaceId ? { workspaceId } : undefined,
      });

      return NextResponse.json({
        success: true,
        data: traces,
        meta: { total: total.length, limit, offset },
      });
    }

    const [traces, total] = await Promise.all([
      db.executionTrace.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { stepOrder: 'asc' }],
        take: limit,
        skip: offset,
      }),
      db.executionTrace.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: traces,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('[GET /api/traces]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch traces' },
      { status: 500 }
    );
  }
}

// POST /api/traces — Start a new execution trace chain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, operation, subsystem, agentId, workflowId, executionId, inputSnapshot, metadata } = body;

    if (!workspaceId || !operation || !subsystem) {
      return NextResponse.json(
        { success: false, error: 'workspaceId, operation, and subsystem are required' },
        { status: 400 }
      );
    }

    // Generate a unique traceId
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create the first trace step
    const trace = await db.executionTrace.create({
      data: {
        workspaceId,
        traceId,
        rootId: null, // will be set to its own id after creation
        operation,
        subsystem,
        status: 'running',
        stepOrder: 0,
        agentId: agentId || null,
        workflowId: workflowId || null,
        executionId: executionId || null,
        inputSnapshot: inputSnapshot ? JSON.stringify(inputSnapshot) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Update rootId to self
    await db.executionTrace.update({
      where: { id: trace.id },
      data: { rootId: trace.id },
    });

    // Emit a system event for trace start
    try {
      await db.systemEvent.create({
        data: {
          workspaceId,
          eventType: 'trace.started',
          source: subsystem as string || 'system',
          level: 'info',
          traceId,
          resourceType: 'execution_trace',
          resourceId: trace.id,
          payload: JSON.stringify({ operation, subsystem, traceId }),
        },
      });
    } catch {
      // event emission is best-effort
    }

    return NextResponse.json({
      success: true,
      data: {
        traceId,
        stepId: trace.id,
        operation,
        subsystem,
        status: 'running',
      },
    });
  } catch (error) {
    console.error('[POST /api/traces]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create trace' },
      { status: 500 }
    );
  }
}
