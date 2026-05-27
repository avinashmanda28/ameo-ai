// ─── AMEO AI — Commerce Memory API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { CommerceMemorySystem } from '@/lib/services/commerce/commerce-memory';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const query = searchParams.get('query') || undefined;
    const agentType = searchParams.get('agentType') || undefined;
    const memoryType = searchParams.get('memoryType') || undefined;
    const validatedMemoryType = ['knowledge', 'state', 'preference', 'result', 'decision'].includes(memoryType || '')
      ? (memoryType as 'knowledge' | 'state' | 'preference' | 'result' | 'decision')
      : undefined;
    const minConfidence = searchParams.get('minConfidence')
      ? parseInt(searchParams.get('minConfidence')!)
      : undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    const memory = new CommerceMemorySystem(workspaceId);

    if (query) {
      const results = await memory.search({ searchText: query, agentType, memoryType: validatedMemoryType, minConfidence, limit });
      return NextResponse.json({ success: true, data: results, total: results.length });
    }

    // GET without query param — list recent memories by type
    const entries = await memory.search({ agentType, memoryType: validatedMemoryType, limit });
    return NextResponse.json({ success: true, data: entries, total: entries.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to query memory' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', key, value, agentType, agentId, memoryType, ttl } = body;

    if (!key || !value || !agentType) {
      return NextResponse.json(
        { success: false, error: 'key, value, and agentType are required' },
        { status: 400 }
      );
    }

    const memory = new CommerceMemorySystem(workspaceId);
    const result = await memory.remember(
      agentId || `${agentType}-${Date.now()}`,
      agentType,
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
      {
        memoryType: (memoryType as any) || 'knowledge',
        ttlMinutes: ttl ? Math.ceil(ttl / 60) : undefined,
      }
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to store memory' },
      { status: 500 }
    );
  }
}
