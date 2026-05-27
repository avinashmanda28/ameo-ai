// ─── AMEO AI — Shopify Integration API Routes ───

import { NextRequest, NextResponse } from 'next/server';
import { ShopifyIntegration, buildShopifyAuthUrl, exchangeShopifyAuthCode } from '@/lib/services/commerce/shopify-integration';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || 'default';
    const action = searchParams.get('action');
    const shop = searchParams.get('shop');

    if (action === 'auth-url' && shop) {
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/commerce/shopify/callback`;
      const scopes = ['read_products', 'write_products', 'read_orders', 'write_orders', 'read_inventory', 'write_inventory'];
      const url = buildShopifyAuthUrl(shop, redirectUri, scopes);
      return NextResponse.json({ success: true, data: { url } });
    }

    // List Shopify stores
    const stores = await db.store.findMany({
      where: { workspaceId, platform: 'shopify' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: stores, total: stores.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId = 'default', shop, accessToken, name } = body;

    if (!shop || !accessToken) {
      return NextResponse.json({ success: false, error: 'Shop domain and access token are required' }, { status: 400 });
    }

    const shopify = new ShopifyIntegration(workspaceId);
    const result = await shopify.connectStore(shop, accessToken, name);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to connect Shopify store' },
      { status: 500 }
    );
  }
}
