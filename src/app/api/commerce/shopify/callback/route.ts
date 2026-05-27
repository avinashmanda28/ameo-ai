// ─── AMEO AI — Shopify OAuth Callback ───

import { NextRequest, NextResponse } from 'next/server';
import { ShopifyIntegration, exchangeShopifyAuthCode } from '@/lib/services/commerce/shopify-integration';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const workspaceId = state || 'default';

    if (!shop || !code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/commerce/stores?error=missing_params`,
        302
      );
    }

    const { accessToken } = await exchangeShopifyAuthCode(shop, code);

    const shopify = new ShopifyIntegration(workspaceId);
    const { storeId } = await shopify.connectStore(shop, accessToken);

    // Trigger initial sync
    const integration = await import('@/lib/db').then((m) =>
      m.db.integration.findFirst({
        where: { workspaceId, provider: 'shopify' },
      })
    );

    if (integration) {
      shopify.syncAll(integration.id, storeId).catch(() => {});
    }

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/commerce/stores?shopify=connected&storeId=${storeId}`;
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/commerce/stores?error=${encodeURIComponent(error instanceof Error ? error.message : 'OAuth failed')}`;
    return NextResponse.redirect(errorUrl, 302);
  }
}
