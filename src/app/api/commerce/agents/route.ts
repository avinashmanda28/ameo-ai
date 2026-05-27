import { NextResponse } from 'next/server';
import { getSwarmOrchestrator } from '@/lib/services/commerce/agents/swarm-orchestrator';
import type { ApiResponse } from '@/lib/types';

export async function GET() {
  try {
    const orchestrator = getSwarmOrchestrator();
    const agents = orchestrator.getAgentInfo();

    const response: ApiResponse = {
      success: true,
      data: { agents },
    };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch agents',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
