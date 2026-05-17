import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/workflows/[id]/executions — List executions for a workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const workflow = await db.workflow.findUnique({ where: { id } })
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const executions = await db.workflowExecution.findMany({
      where: {
        workflowId: id,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: executions })
  } catch (error) {
    console.error('[GET /api/workflows/[id]/executions]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workflow executions' },
      { status: 500 }
    )
  }
}

// POST /api/workflows/[id]/executions — Create a new workflow execution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { agentId, stepName, input } = body

    const workflow = await db.workflow.findUnique({ where: { id } })
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const execution = await db.workflowExecution.create({
      data: {
        workflowId: id,
        status: 'pending',
        ...(agentId && { agentId }),
        ...(stepName && { stepName }),
        ...(input !== undefined && { input: typeof input === 'string' ? input : JSON.stringify(input) }),
      },
    })

    // Log execution creation
    await db.workflowLog.create({
      data: {
        workflowId: id,
        executionId: execution.id,
        level: 'info',
        message: `Execution created: ${execution.id} with status 'pending'`,
      },
    })

    return NextResponse.json({ success: true, data: execution }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/workflows/[id]/executions]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create workflow execution' },
      { status: 500 }
    )
  }
}
