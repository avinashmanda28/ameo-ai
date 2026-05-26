import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/execution/[id]/verify — Run verification on an execution
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: executionId } = await params

    const execution = await db.runtimeExecution.findUnique({
      where: { id: executionId },
    })

    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      )
    }

    if (execution.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Only completed executions can be verified' },
        { status: 400 }
      )
    }

    // Try to use RuntimeEngine for verification
    let verifyResult
    try {
      const { RuntimeEngine } = await import('@/lib/engine/engine')
      const engine = new RuntimeEngine()
      verifyResult = await engine.verify(executionId, db)
    } catch (engineError) {
      console.warn('[POST /api/execution/[id]/verify] RuntimeEngine not available, running basic verification:', engineError)

      // Basic fallback verification logic
      const responseText = execution.response || ''
      const promptText = execution.prompt || ''
      const hasResponse = responseText.length > 0
      const hasTokens = execution.tokenUsage ? JSON.parse(execution.tokenUsage).totalTokens > 0 : false
      const hasLatency = execution.latencyMs !== null && execution.latencyMs !== undefined

      if (hasResponse && (hasTokens || hasLatency)) {
        verifyResult = {
          verificationResult: 'pass',
          verificationNotes: 'Basic verification passed — response present with token usage or latency data.',
        }
      } else if (hasResponse) {
        verifyResult = {
          verificationResult: 'warning',
          verificationNotes: 'Response present but missing token usage and latency data.',
        }
      } else {
        verifyResult = {
          verificationResult: 'fail',
          verificationNotes: 'No response data found for this execution.',
        }
      }
    }

    // Update execution with verification results
    const updatedExecution = await db.runtimeExecution.update({
      where: { id: executionId },
      data: {
        verificationResult: verifyResult.verificationResult,
        verificationNotes: verifyResult.verificationNotes,
      },
    })

    // Create audit log entry
    await db.auditLog.create({
      data: {
        workspaceId: execution.workspaceId,
        action: 'execution_verified',
        resource: executionId,
        severity: verifyResult.verificationResult === 'fail' ? 'high' : verifyResult.verificationResult === 'warning' ? 'medium' : 'info',
        details: JSON.stringify({
          verificationResult: verifyResult.verificationResult,
          verificationNotes: verifyResult.verificationNotes,
          requestType: execution.requestType,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        execution: updatedExecution,
        verificationResult: verifyResult.verificationResult,
        verificationNotes: verifyResult.verificationNotes,
      },
    })
  } catch (error) {
    console.error('[POST /api/execution/[id]/verify]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify execution' },
      { status: 500 }
    )
  }
}
