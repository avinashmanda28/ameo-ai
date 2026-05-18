import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/queue/[id] — Get a single queue item by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const item = await db.executionQueue.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Queue item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    console.error('[GET /api/queue/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch queue item' },
      { status: 500 }
    )
  }
}

// PATCH /api/queue/[id] — Update a queue item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.executionQueue.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Queue item not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      status,
      priority,
      retryCount,
      nextRetryAt,
      lastError,
      failureType,
      failureSeverity,
      result,
      completedAt,
      startedAt,
    } = body

    const updateData: Record<string, unknown> = {}

    if (status !== undefined) updateData.status = status
    if (typeof priority === 'number') updateData.priority = priority
    if (typeof retryCount === 'number') updateData.retryCount = retryCount
    if (nextRetryAt !== undefined) {
      updateData.nextRetryAt = nextRetryAt ? new Date(nextRetryAt) : null
    }
    if (lastError !== undefined) {
      updateData.lastError = lastError ? String(lastError) : null
    }
    if (failureType !== undefined) {
      updateData.failureType = failureType ? String(failureType) : null
    }
    if (failureSeverity !== undefined) {
      updateData.failureSeverity = failureSeverity ? String(failureSeverity) : null
    }
    if (result !== undefined) {
      updateData.result = result ? String(result) : null
    }
    if (completedAt !== undefined) {
      updateData.completedAt = completedAt ? new Date(completedAt) : null
    }
    if (startedAt !== undefined) {
      updateData.startedAt = startedAt ? new Date(startedAt) : null
    }

    // Auto-set completedAt when status transitions to completed or failed or cancelled
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      if (!updateData.completedAt) {
        updateData.completedAt = new Date()
      }
    }

    const updated = await db.executionQueue.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PATCH /api/queue/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update queue item' },
      { status: 500 }
    )
  }
}

// DELETE /api/queue/[id] — Cancel a queue item (soft delete via status)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.executionQueue.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Queue item not found' },
        { status: 404 }
      )
    }

    // Only allow cancelling items that haven't completed yet
    if (existing.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a completed queue item' },
        { status: 400 }
      )
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Queue item is already cancelled' },
        { status: 400 }
      )
    }

    const cancelled = await db.executionQueue.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: cancelled })
  } catch (error) {
    console.error('[DELETE /api/queue/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel queue item' },
      { status: 500 }
    )
  }
}
