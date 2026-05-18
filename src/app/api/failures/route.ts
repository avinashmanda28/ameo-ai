import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/failures — List failure records with filters and aggregations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId') || undefined
    const failureType = searchParams.get('failureType') || undefined
    const category = searchParams.get('category') || undefined
    const providerId = searchParams.get('providerId') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where: Record<string, unknown> = {}
    if (workspaceId) where.workspaceId = workspaceId
    if (failureType) where.failureType = failureType
    if (category) where.category = category
    if (providerId) where.providerId = providerId

    const [records, total, failureTypeAgg, categoryAgg] = await Promise.all([
      db.failureRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.failureRecord.count({ where }),
      // Aggregation by failureType
      db.failureRecord.groupBy({
        by: ['failureType'],
        where: workspaceId ? { workspaceId } : undefined,
        _count: { failureType: true },
        orderBy: { _count: { failureType: 'desc' } },
      }),
      // Aggregation by category
      db.failureRecord.groupBy({
        by: ['category'],
        where: workspaceId ? { workspaceId } : undefined,
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
      }),
    ])

    const failureTypeCounts: Record<string, number> = {}
    for (const group of failureTypeAgg) {
      failureTypeCounts[group.failureType] = group._count.failureType
    }

    const categoryCounts: Record<string, number> = {}
    for (const group of categoryAgg) {
      categoryCounts[group.category] = group._count.category
    }

    return NextResponse.json({
      success: true,
      data: records,
      meta: {
        total,
        limit,
        offset,
        aggregations: {
          byFailureType: failureTypeCounts,
          byCategory: categoryCounts,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/failures]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch failure records' },
      { status: 500 }
    )
  }
}

// POST /api/failures — Create a failure record with recurring failure detection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      executionId,
      queueId,
      providerId,
      workflowId,
      failureType,
      failureSeverity,
      category,
      errorMessage,
      errorStack,
      providerType,
      modelId,
      recoveryAction,
    } = body

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId is required' },
        { status: 400 }
      )
    }
    if (!failureType) {
      return NextResponse.json(
        { success: false, error: 'failureType is required' },
        { status: 400 }
      )
    }
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'category is required' },
        { status: 400 }
      )
    }
    if (!errorMessage) {
      return NextResponse.json(
        { success: false, error: 'errorMessage is required' },
        { status: 400 }
      )
    }

    const validFailureTypes = [
      'timeout',
      'auth_failed',
      'rate_limited',
      'provider_unavailable',
      'connection_refused',
      'validation_failed',
      'unknown',
    ]
    if (!validFailureTypes.includes(failureType)) {
      return NextResponse.json(
        { success: false, error: `Invalid failureType. Must be one of: ${validFailureTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validCategories = ['runtime', 'workflow', 'governance', 'network', 'system']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for recurring failures: same failureType + provider within the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    let isRecurring = false
    let occurrenceCount = 1
    let existingRecurringRecord: typeof body & { id: string } | null = null

    if (providerId) {
      const recentFailure = await db.failureRecord.findFirst({
        where: {
          workspaceId,
          failureType,
          providerId,
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (recentFailure) {
        isRecurring = true
        occurrenceCount = recentFailure.occurrenceCount + 1
        existingRecurringRecord = recentFailure as unknown as typeof body & { id: string }

        // Update the existing recurring record's occurrence count
        await db.failureRecord.update({
          where: { id: recentFailure.id },
          data: {
            isRecurring: true,
            occurrenceCount,
          },
        })
      }
    }

    // Create the new failure record
    const record = await db.failureRecord.create({
      data: {
        workspaceId,
        executionId: executionId || null,
        queueId: queueId || null,
        providerId: providerId || null,
        workflowId: workflowId || null,
        failureType,
        failureSeverity: failureSeverity || 'medium',
        category,
        errorMessage: String(errorMessage),
        errorStack: errorStack ? String(errorStack) : null,
        providerType: providerType || null,
        modelId: modelId || null,
        recoveryAction: recoveryAction || null,
        isRecurring,
        occurrenceCount: isRecurring ? occurrenceCount : 1,
      },
    })

    return NextResponse.json({
      success: true,
      data: record,
      meta: isRecurring
        ? {
            isRecurring: true,
            occurrenceCount,
            linkedToId: existingRecurringRecord?.id || null,
            message: `Recurring failure detected: ${failureType} has occurred ${occurrenceCount} times in the last hour`,
          }
        : undefined,
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/failures]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create failure record' },
      { status: 500 }
    )
  }
}
