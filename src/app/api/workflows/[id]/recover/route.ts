import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/workflows/[id]/recover — Recover a workflow from its latest checkpoint
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Step 1: Find the workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Step 2: Find the latest checkpoint for this workflow
    const checkpoint = await db.workflowCheckpoint.findFirst({
      where: { workflowId: id },
      orderBy: { createdAt: 'desc' },
    })

    if (!checkpoint) {
      return NextResponse.json(
        { success: false, error: 'No checkpoint found for this workflow. Cannot recover without a checkpoint.' },
        { status: 400 }
      )
    }

    // Step 3: Create a new WorkflowExecution from the checkpoint data
    const execution = await db.workflowExecution.create({
      data: {
        workflowId: id,
        agentId: checkpoint.executionId || null,
        status: 'pending',
        stepName: checkpoint.name,
        input: checkpoint.data,
        error: null,
        retryCount: 0,
      },
    })

    // Step 4: Set workflow state to 'recovering'
    const updatedWorkflow = await db.workflow.update({
      where: { id },
      data: { state: 'recovering' },
    })

    // Step 5: Create WorkflowLog entry for the recovery action
    const logEntry = await db.workflowLog.create({
      data: {
        workflowId: id,
        executionId: execution.id,
        level: 'info',
        message: `Workflow recovery initiated from checkpoint "${checkpoint.name}" (created at ${checkpoint.createdAt.toISOString()})`,
        metadata: JSON.stringify({
          action: 'recover',
          checkpointId: checkpoint.id,
          checkpointName: checkpoint.name,
          checkpointState: checkpoint.state,
          checkpointCreatedAt: checkpoint.createdAt.toISOString(),
          newExecutionId: execution.id,
          previousState: workflow.state,
        }),
      },
    })

    // Step 6: Return the new execution
    return NextResponse.json({
      success: true,
      data: {
        execution,
        workflow: updatedWorkflow,
        checkpoint: {
          id: checkpoint.id,
          name: checkpoint.name,
          state: checkpoint.state,
          createdAt: checkpoint.createdAt,
        },
        logEntry: {
          id: logEntry.id,
          message: logEntry.message,
        },
      },
    })
  } catch (error) {
    console.error('[POST /api/workflows/[id]/recover]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to recover workflow' },
      { status: 500 }
    )
  }
}
