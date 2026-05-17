import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/approvals/[id] — Get single approval request
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const approval = await db.approvalRequest.findUnique({
      where: { id },
      include: {
        executions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            requestType: true,
            createdAt: true,
          },
        },
      },
    })

    if (!approval) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: approval })
  } catch (error) {
    console.error('[GET /api/approvals/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approval request' },
      { status: 500 }
    )
  }
}

// POST /api/approvals/[id]/resolve — Resolve approval (approve or reject)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, reason } = body

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action is required and must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    const approval = await db.approvalRequest.findUnique({
      where: { id },
    })

    if (!approval) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      )
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Approval request is already ${approval.status}` },
        { status: 400 }
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update the approval request
    const updatedApproval = await db.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
        resolvedBy: 'user',
        ...(action === 'reject' && reason && { reason }),
      },
    })

    // Handle linked execution
    if (approval.executionId) {
      const execution = await db.runtimeExecution.findUnique({
        where: { id: approval.executionId },
      })

      if (execution) {
        if (action === 'approve') {
          // Update execution status and link approval
          await db.runtimeExecution.update({
            where: { id: execution.id },
            data: {
              status: 'approved',
              approvalId: approval.id,
              approvedAt: new Date(),
              approvedBy: 'user',
            },
          })

          // Attempt to resume execution via engine
          try {
            const { RuntimeEngine } = await import('@/lib/runtime/engine')
            const engine = new RuntimeEngine()
            await engine.resumeAfterApproval(execution.id, true, db)
          } catch (engineError) {
            // Engine not available — set to approved but note engine isn't connected
            console.warn('[POST /api/approvals/[id]] RuntimeEngine not available for resume:', engineError)
            await db.runtimeExecution.update({
              where: { id: execution.id },
              data: {
                response: 'Execution approved but RuntimeEngine not yet connected for execution.',
              },
            })
          }
        } else {
          // Reject: update execution status
          await db.runtimeExecution.update({
            where: { id: execution.id },
            data: {
              status: 'rejected',
              approvalId: approval.id,
              errorMessage: reason || 'Execution rejected by user',
            },
          })

          // Create audit log for rejection
          await db.auditLog.create({
            data: {
              workspaceId: approval.workspaceId,
              action: 'execution_rejected',
              resource: execution.id,
              severity: 'high',
              details: JSON.stringify({
                approvalId: approval.id,
                reason: reason || null,
                requestType: execution.requestType,
              }),
            },
          })
        }
      }
    }

    // Create audit log for the resolution
    await db.auditLog.create({
      data: {
        workspaceId: approval.workspaceId,
        action: `approval_${newStatus}`,
        resource: approval.id,
        severity: action === 'reject' ? 'high' : 'info',
        details: JSON.stringify({
          approvalId: approval.id,
          requestType: approval.requestType,
          executionId: approval.executionId || null,
          action: newStatus,
          reason: reason || null,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedApproval,
    })
  } catch (error) {
    console.error('[POST /api/approvals/[id]]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resolve approval request' },
      { status: 500 }
    )
  }
}
