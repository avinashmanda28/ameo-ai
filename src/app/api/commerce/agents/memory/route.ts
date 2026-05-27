import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';
import type { CommerceAgentType } from '@/lib/services/commerce/agents/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const agentType = searchParams.get('agentType');
    const memoryType = searchParams.get('memoryType');
    const key = searchParams.get('key');

    const where: Record<string, unknown> = { workspaceId };
    if (agentType) where.agentType = agentType;
    if (memoryType) where.memoryType = memoryType;
    if (key) where.key = { contains: key };

    // Exclude expired entries
    const records = await db.agentMemory.findMany({
      where: {
        ...where,
        OR: [
          { ttl: null },
          { ttl: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const response: ApiResponse = { success: true, data: records };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch memory',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId = 'default', memoryType, agentType } = body;

    const where: Record<string, unknown> = { workspaceId };
    if (memoryType) where.memoryType = memoryType;
    if (agentType) where.agentType = agentType;

    const result = await db.agentMemory.deleteMany({ where });

    const response: ApiResponse = { success: true, data: { deleted: result.count } };
    return NextResponse.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear memory',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
