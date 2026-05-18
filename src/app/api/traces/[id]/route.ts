import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/traces/[id] — Get single trace step or full trace chain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const chain = searchParams.get('chain') === 'true'

    // ?chain=true — return all steps for the same traceId
    if (chain) {
      const trace = await db.executionTrace.findUnique({
        where: { id },
        select: { traceId: true },
      })

      if (!trace) {
        return NextResponse.json(
          { success: false, error: 'Trace step not found' },
          { status: 404 }
        )
      }

      const chainSteps = await db.executionTrace.findMany({
        where: { traceId: trace.traceId },
        orderBy: { stepOrder: 'asc' },
      })

      // Calculate chain summary
      const totalDuration = chainSteps.reduce((sum, s) => {
        if (s.durationMs) return sum + s.durationMs
        return sum
      }, 0)

      const failedSteps = chainSteps.filter((s) => s.status === 'failed')
      const completedSteps = chainSteps.filter((s) => s.status === 'completed')
      const overallStatus = failedSteps.length > 0
        ? 'failed'
        : chainSteps.every((s) => s.status === 'completed')
          ? 'completed'
          : 'running'

      return NextResponse.json({
        success: true,
        data: chainSteps.map((s) => ({
          ...s,
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt?.toISOString() || null,
        })),
        meta: {
          chain: true,
          traceId: trace.traceId,
          total: chainSteps.length,
          overallStatus,
          totalDurationMs: totalDuration,
          completedSteps: completedSteps.length,
          failedSteps: failedSteps.length,
        },
      })
    }

    // Default: return single trace step
    const trace = await db.executionTrace.findUnique({ where: { id } })

    if (!trace) {
      return NextResponse.json(
        { success: false, error: 'Trace step not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...trace,
        startedAt: trace.startedAt.toISOString(),
        completedAt: trace.completedAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('[GET /api/traces/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trace' },
      { status: 500 }
    )
  }
}
