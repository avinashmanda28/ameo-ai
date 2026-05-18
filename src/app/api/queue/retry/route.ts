import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/queue/retry — Retry a failed queue item with exponential backoff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, retryDelayMs } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const item = await db.executionQueue.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Queue item not found' },
        { status: 404 }
      )
    }

    if (item.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: `Cannot retry item with status '${item.status}'. Only failed items can be retried.` },
        { status: 400 }
      )
    }

    const newRetryCount = item.retryCount + 1

    if (newRetryCount > item.maxRetries) {
      return NextResponse.json(
        { success: false, error: `Max retries (${item.maxRetries}) already exceeded. retryCount=${item.retryCount}` },
        { status: 400 }
      )
    }

    // Exponential backoff: delay = retryDelayMs * 2^retryCount
    const baseDelay = retryDelayMs || item.retryDelayMs || 1000
    const delayMs = baseDelay * Math.pow(2, item.retryCount)
    const nextRetryAt = new Date(Date.now() + delayMs)

    const updated = await db.executionQueue.update({
      where: { id },
      data: {
        status: 'retrying',
        retryCount: newRetryCount,
        nextRetryAt,
        lastError: null,
        failureType: null,
        failureSeverity: null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        _meta: {
          retryAttempt: newRetryCount,
          maxRetries: item.maxRetries,
          backoffDelayMs: delayMs,
          nextRetryAt: nextRetryAt.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('[POST /api/queue/retry]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retry queue item' },
      { status: 500 }
    )
  }
}
