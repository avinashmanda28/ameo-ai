import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/execution/[id] — Get single execution with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const execution = await db.runtimeExecution.findUnique({
      where: { id },
      include: {
        provider: {
          select: { id: true, name: true, type: true, modelId: true, status: true },
        },
        agent: {
          select: { id: true, name: true, type: true, status: true },
        },
        artifact: {
          select: { id: true, title: true, type: true, version: true },
        },
        approval: {
          select: {
            id: true,
            status: true,
            requestType: true,
            resolvedAt: true,
            resolvedBy: true,
            reason: true,
          },
        },
      },
    })

    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: execution })
  } catch (error) {
    console.error('[GET /api/execution/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch execution' },
      { status: 500 }
    )
  }
}

// DELETE /api/execution/[id] — Delete execution
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.runtimeExecution.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      )
    }

    await db.runtimeExecution.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/execution/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete execution' },
      { status: 500 }
    )
  }
}
