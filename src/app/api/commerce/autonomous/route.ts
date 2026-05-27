// ─── AMEO AI — Autonomous Execution API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { AutonomousExecutionService } from '@/lib/services/commerce/autonomous-execution';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const exec = new AutonomousExecutionService(workspaceId);

    const [session, stats, policies, pendingApprovals] = await Promise.all([
      exec.getSessionStatus(),
      exec.getStats(),
      exec.listPolicies(),
      db.approvalRequest.findMany({
        where: { workspaceId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { session, stats, policies, pendingApprovals },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch execution data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const exec = new AutonomousExecutionService(workspaceId);

    switch (action) {
      case 'create-policy': {
        const result = await exec.createPolicy(params);
        return NextResponse.json({ success: true, data: result }, { status: 201 });
      }
      case 'set-policy': {
        const { policyId, enabled } = params;
        if (!policyId) {
          return NextResponse.json({ success: false, error: 'policyId is required' }, { status: 400 });
        }
        await exec.setPolicy(policyId, enabled !== false);
        return NextResponse.json({ success: true, message: `Policy ${enabled ? 'enabled' : 'disabled'}` });
      }
      case 'execute': {
        const { type, resourceType, resourceId, estimatedImpact, mode, approved } = params;
        if (!type) {
          return NextResponse.json({ success: false, error: 'Action type is required' }, { status: 400 });
        }
        const result = await exec.executeAction(
          { type, resourceType, resourceId, params: params.actionParams || {}, estimatedImpact },
          mode || 'assisted',
          approved
        );
        return NextResponse.json({ success: true, data: result });
      }
      case 'evaluate': {
        const decision = await exec.evaluateAction(params);
        return NextResponse.json({ success: true, data: decision });
      }
      case 'rollback': {
        if (!params.executionId) {
          return NextResponse.json({ success: false, error: 'executionId is required' }, { status: 400 });
        }
        const result = await exec.rollbackExecution(params.executionId);
        return NextResponse.json({ success: true, data: result });
      }
      case 'approve': {
        const { approvalId } = params;
        if (!approvalId) {
          return NextResponse.json({ success: false, error: 'approvalId is required' }, { status: 400 });
        }
        await db.approvalRequest.update({
          where: { id: approvalId },
          data: { status: 'approved' },
        });
        return NextResponse.json({ success: true, message: 'Approval granted' });
      }
      case 'reject': {
        const { approvalId: rejectId } = params;
        if (!rejectId) {
          return NextResponse.json({ success: false, error: 'approvalId is required' }, { status: 400 });
        }
        await db.approvalRequest.update({
          where: { id: rejectId },
          data: { status: 'rejected' },
        });
        return NextResponse.json({ success: true, message: 'Approval rejected' });
      }
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: create-policy, set-policy, execute, evaluate, rollback, approve, or reject' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Execution operation failed' },
      { status: 500 }
    );
  }
}
