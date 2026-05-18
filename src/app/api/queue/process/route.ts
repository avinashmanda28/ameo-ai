import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/queue/process — Claim and process the next pending queue item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { workspaceId } = body

    const now = new Date()

    // Build the filter: pending items whose scheduledAt has passed
    // OR retrying items whose nextRetryAt has passed
    const where: Record<string, unknown> = {
      OR: [
        {
          status: 'pending',
          scheduledAt: { lte: now },
        },
        {
          status: 'retrying',
          nextRetryAt: { lte: now },
        },
      ],
    }

    // Optionally filter by workspace
    if (workspaceId) {
      (where.OR as Array<Record<string, unknown>>).forEach((condition) => {
        condition.workspaceId = workspaceId
      })
    }

    // Find the highest-priority item that is due
    const item = await db.executionQueue.findFirst({
      where,
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    if (!item) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No pending items',
      })
    }

    // Mark as running
    const updated = await db.executionQueue.update({
      where: { id: item.id },
      data: {
        status: 'running',
        startedAt: now,
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('[POST /api/queue/process]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process queue item' },
      { status: 500 }
    )
  }
}
