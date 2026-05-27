import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSupplierIntelligence } from '@/lib/services/commerce/supplier-intelligence';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const query = searchParams.get('query') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const status = searchParams.get('status') || undefined;
    const sortBy = (searchParams.get('sortBy') || 'overallScore') as string;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const si = getSupplierIntelligence();
    const result = await si.searchSuppliers(workspaceId, {
      query, platform, status, sortBy: sortBy as any, sortOrder, limit, offset,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', name, platform, platformUrl, description, country, rating } = body;

    if (!name || !platform) {
      return NextResponse.json({ success: false, error: 'Name and platform are required' }, { status: 400 });
    }

    const supplier = await db.supplier.create({
      data: {
        workspaceId,
        name,
        platform,
        platformUrl,
        description,
        country,
        rating: rating ? parseFloat(rating) : null,
        status: 'discovered',
      },
    });

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
