// ─── AMEO AI — Product Page Generator API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { ProductPageGenerator } from '@/lib/services/commerce/product-page-generator';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const productId = searchParams.get('productId');

    if (productId) {
      const pages = await db.productPage.findMany({
        where: { workspaceId, productId },
        orderBy: { version: 'desc' },
      });
      return NextResponse.json({ success: true, data: { pages, stats: { total: pages.length } } });
    }

    const allPages = await db.productPage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalCount = await db.productPage.count({ where: { workspaceId } });
    return NextResponse.json({ success: true, data: { pages: allPages, stats: { total: totalCount } } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch product pages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', productId, action, ...params } = body;

    const generator = new ProductPageGenerator(workspaceId);

    if (action === 'generate' || !action) {
      if (!productId) {
        return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 });
      }
      const result = await generator.generatePage({
        productId,
        seoOptimize: params.seoOptimize !== false,
        includeFaq: params.includeFaq !== false,
        tone: params.tone,
      });
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    if (action === 'revise') {
      const { pageId, instructions } = params;
      if (!pageId || !instructions) {
        return NextResponse.json({ success: false, error: 'pageId and instructions are required' }, { status: 400 });
      }
      const result = await generator.revisePage(pageId, instructions);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use: generate or revise' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate product page' },
      { status: 500 }
    );
  }
}
