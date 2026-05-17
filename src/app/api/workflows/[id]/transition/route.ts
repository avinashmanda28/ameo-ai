import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/workflows/[id]/transition — State transition for a workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { state } = body

    if (!state) {
      return NextResponse.json(
        { success: false, error: 'state is required' },
        { status: 400 }
      )
    }

    const validStates = ['draft', 'validated', 'active', 'blocked', 'recovering', 'completed', 'archived']
    if (!validStates.includes(state)) {
      return NextResponse.json(
        { success: false, error: `Invalid state. Must be one of: ${validStates.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await db.workflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const previousState = existing.state

    const updated = await db.workflow.update({
      where: { id },
      data: { state },
    })

    // Log the transition
    await db.workflowLog.create({
      data: {
        workflowId: id,
        level: 'info',
        message: `Workflow state transitioned: ${previousState} → ${state}`,
        metadata: JSON.stringify({ previousState, newState: state, transitionedAt: new Date().toISOString() }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[POST /api/workflows/[id]/transition]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to transition workflow state' },
      { status: 500 }
    )
  }
}
