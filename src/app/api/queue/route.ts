import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/queue — List queue items with filters and status counts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const workspaceId = searchParams.get('workspaceId') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (workspaceId) where.workspaceId = workspaceId

    const [items, total, statusCounts] = await Promise.all([
      db.executionQueue.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { scheduledAt: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.executionQueue.count({ where }),
      db.executionQueue.groupBy({
        by: ['status'],
        where: workspaceId ? { workspaceId } : undefined,
        _count: { status: true },
      }),
    ])

    // Build counts map: { pending: 5, running: 2, ... }
    const countsMap: Record<string, number> = {}
    for (const group of statusCounts) {
      countsMap[group.status] = group._count.status
    }

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        total,
        limit,
        offset,
        counts: countsMap,
      },
    })
  } catch (error) {
    console.error('[GET /api/queue]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch queue items' },
      { status: 500 }
    )
  }
}

// POST /api/queue — Create a new queue item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      executionId,
      providerId,
      agentId,
      workflowId,
      requestType,
      prompt,
      systemPrompt,
      modelId,
      temperature,
      maxTokens,
      priority,
      maxRetries,
      retryDelayMs,
      scheduledAt,
    } = body

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId is required' },
        { status: 400 }
      )
    }
    if (!requestType) {
      return NextResponse.json(
        { success: false, error: 'requestType is required' },
        { status: 400 }
      )
    }
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      )
    }

    const item = await db.executionQueue.create({
      data: {
        workspaceId,
        executionId: executionId || null,
        status: 'pending',
        priority: typeof priority === 'number' ? priority : 0,
        providerId: providerId || null,
        agentId: agentId || null,
        workflowId: workflowId || null,
        requestType,
        prompt,
        systemPrompt: systemPrompt || null,
        modelId: modelId || null,
        temperature: temperature ?? null,
        maxTokens: maxTokens ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        retryCount: 0,
        maxRetries: typeof maxRetries === 'number' ? maxRetries : 3,
        retryDelayMs: typeof retryDelayMs === 'number' ? retryDelayMs : 1000,
      },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/queue]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create queue item' },
      { status: 500 }
    )
  }
}
