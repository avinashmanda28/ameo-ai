import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProductIntelligence } from '@/lib/services/commerce/product-intelligence';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const query = searchParams.get('query') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const sourcePlatform = searchParams.get('sourcePlatform') || undefined;
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined;
    const sortBy = (searchParams.get('sortBy') || 'overallScore') as string;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const pi = getProductIntelligence();
    const result = await pi.searchProducts(workspaceId, {
      query,
      category,
      status,
      sourcePlatform,
      minScore,
      sortBy: sortBy as any,
      sortOrder,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', name, description, category, price, costPrice, currency, sku, imageUrl, supplierUrl, sourcePlatform } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Product name is required' }, { status: 400 });
    }

    const product = await db.product.create({
      data: {
        workspaceId,
        name,
        description,
        category,
        price: price ? parseFloat(price) : null,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        currency: currency || 'USD',
        sku,
        imageUrl,
        supplierUrl,
        sourcePlatform: sourcePlatform || 'manual',
        status: 'discovered',
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    );
  }
}
