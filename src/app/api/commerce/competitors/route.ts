// ─── AMEO AI — Competitor Intelligence API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { CompetitorIntelligence } from '@/lib/services/commerce/competitor-intelligence';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';

    const ci = new CompetitorIntelligence(workspaceId);

    const [competitors, stats, opportunities] = await Promise.all([
      ci.listCompetitors(),
      ci.getStats(),
      ci.findOpportunities(),
    ]);

    return NextResponse.json({
      success: true,
      data: { competitors, stats, opportunities },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch competitor data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', action, ...params } = body;

    const ci = new CompetitorIntelligence(workspaceId);

    switch (action) {
      case 'add-competitor': {
        const result = await ci.addCompetitor(params);
        return NextResponse.json({ success: true, data: result }, { status: 201 });
      }
      case 'track-product': {
        const result = await ci.trackCompetitorProduct(params);
        return NextResponse.json({ success: true, data: result }, { status: 201 });
      }
      case 'compare-prices': {
        if (!params.productId) {
          return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 });
        }
        const result = await ci.comparePrices(params.productId);
        return NextResponse.json({ success: true, data: result });
      }
      case 'bulk-compare': {
        const results = await ci.bulkComparePrices();
        return NextResponse.json({ success: true, data: results });
      }
      case 'analyze-market': {
        if (!params.category) {
          return NextResponse.json({ success: false, error: 'category is required' }, { status: 400 });
        }
        const result = await ci.analyzeMarket(params.category);
        return NextResponse.json({ success: true, data: result });
      }
      case 'assess-threats': {
        const threats = await ci.assessThreats();
        return NextResponse.json({ success: true, data: threats });
      }
      case 'find-opportunities': {
        const opportunities = await ci.findOpportunities();
        return NextResponse.json({ success: true, data: opportunities });
      }
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: add-competitor, track-product, compare-prices, bulk-compare, analyze-market, assess-threats, or find-opportunities' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Competitor intelligence operation failed' },
      { status: 500 }
    );
  }
}
