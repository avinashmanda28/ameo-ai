import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTrendDiscovery } from '@/lib/services/commerce/trend-discovery';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const query = searchParams.get('query') || undefined;
    const source = searchParams.get('source') || undefined;
    const status = searchParams.get('status') || undefined;
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined;
    const sortBy = (searchParams.get('sortBy') || 'overallScore') as string;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const td = getTrendDiscovery();
    const result = await td.searchTrends(workspaceId, {
      query, source, status, minScore, sortBy: sortBy as any, sortOrder, limit, offset,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', name, keyword, source, category, description } = body;

    if (!name || !keyword) {
      return NextResponse.json({ success: false, error: 'Name and keyword are required' }, { status: 400 });
    }

    const trend = await db.trend.create({
      data: {
        workspaceId,
        name,
        keyword,
        source: source || 'manual',
        category,
        description,
        status: 'discovered',
      },
    });

    return NextResponse.json({ success: true, data: trend }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create trend' },
      { status: 500 }
    );
  }
}
