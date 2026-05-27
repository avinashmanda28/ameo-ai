// ─── AMEO AI — Product Import Pipeline API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { ProductImportPipeline } from '@/lib/services/commerce/product-import';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const pipeline = new ProductImportPipeline(workspaceId);
    const stats = await pipeline.getStats();

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get import stats' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const pipeline = new ProductImportPipeline(workspaceId);

    if (action === 'import' || action === 'import-products') {
      const result = await pipeline.importProducts(params);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'import-url') {
      const { url, sourcePlatform, targetStoreId } = params;
      if (!url || !sourcePlatform) {
        return NextResponse.json({ success: false, error: 'URL and source platform are required' }, { status: 400 });
      }
      const result = await pipeline.importFromUrl(url, sourcePlatform, targetStoreId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use: import, import-products, or import-url' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
