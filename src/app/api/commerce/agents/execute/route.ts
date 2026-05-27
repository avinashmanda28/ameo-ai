import { NextRequest, NextResponse } from 'next/server';
import { getSwarmOrchestrator } from '@/lib/services/commerce/agents/swarm-orchestrator';
import type { ApiResponse } from '@/lib/types';
import type { CommerceAgentType } from '@/lib/services/commerce/agents/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentType, input, workspaceId = 'default', action } = body;

    if (!agentType && !action) {
      const response: ApiResponse = {
        success: false,
        error: 'agentType or action is required',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const orchestrator = getSwarmOrchestrator();

    if (action === 'workflow' && body.agents) {
      // Execute multi-agent workflow
      const result = await orchestrator.executeMultiAgentWorkflow({
        workspaceId,
        workflowId: body.workflowId || `wf_${Date.now()}`,
        agents: body.agents,
      });
      const apiResponse: ApiResponse = { success: result.overallSuccess, data: result };
      return NextResponse.json(apiResponse);
    }

    if (action === 'goal' && body.goal) {
      // Execute goal-driven swarm
      const result = await orchestrator.executeSwarmGoal({
        workspaceId,
        goal: body.goal,
        preferredAgent: body.preferredAgent as CommerceAgentType | undefined,
        priority: body.priority,
      });
      const apiResponse: ApiResponse = { success: result.status === 'completed', data: result };
      return NextResponse.json(apiResponse);
    }

    // Execute single agent
    const taskId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await orchestrator.executeAgentTask({
      workspaceId,
      agentType: agentType as CommerceAgentType,
      taskId,
      input: input || {},
      traceId: body.traceId || null,
      correlationId: body.correlationId || null,
    });

    const apiResponse: ApiResponse = { success: result.success, data: result };
    return NextResponse.json(apiResponse);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Agent execution failed',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
