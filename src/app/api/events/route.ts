import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/events — List system events with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const level = searchParams.get('level') || undefined;
    const source = searchParams.get('source') || undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const traceId = searchParams.get('traceId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};
    if (workspaceId) where.workspaceId = workspaceId;
    if (level) where.level = level;
    if (source) where.source = source;
    if (eventType) where.eventType = eventType;
    if (traceId) where.traceId = traceId;

    const [events, total] = await Promise.all([
      db.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.systemEvent.count({ where }),
    ]);

    // Level counts
    const levelCounts = await db.systemEvent.groupBy({
      by: ['level'],
      where: workspaceId ? { workspaceId } : undefined,
      _count: { level: true },
    });
    const countsMap: Record<string, number> = {};
    for (const group of levelCounts) {
      countsMap[group.level] = group._count.level;
    }

    return NextResponse.json({
      success: true,
      data: events,
      meta: { total, limit, offset, levelCounts: countsMap },
    });
  } catch (error) {
    console.error('[GET /api/events]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events — Create a new system event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      workspaceId,
      eventType,
      source,
      level,
      correlationId,
      causationId,
      traceId,
      payload,
      resourceType,
      resourceId,
      actorId,
      actorType,
      tags,
    } = body;

    if (!workspaceId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'workspaceId and eventType are required' },
        { status: 400 }
      );
    }

    const event = await db.systemEvent.create({
      data: {
        workspaceId,
        eventType,
        source: source || null,
        level: level || 'info',
        correlationId: correlationId || null,
        causationId: causationId || null,
        traceId: traceId || null,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload || null),
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        actorId: actorId || null,
        actorType: actorType || null,
        tags: typeof tags === 'string' ? tags : JSON.stringify(tags || null),
      },
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/events]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
