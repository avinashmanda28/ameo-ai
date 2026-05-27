// ═══════════════════════════════════════════════════════════════
// AMEO AI — Shopify Integration (System 1)
// Real Shopify integration with OAuth, product/order/inventory
// sync, fulfillment management, and webhook handling.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';
import { registerProviderAdapter, type ProviderAdapter, type IntegrationConfig } from './integration-hub';

// ─── Shopify API Client ───

export class ShopifyClient {
  private shop: string;
  private accessToken: string;
  private apiVersion = '2024-04';

  constructor(shop: string, accessToken: string) {
    this.shop = shop;
    this.accessToken = accessToken;
  }

  private get baseUrl(): string {
    return `https://${this.shop}.myshopify.com/admin/api/${this.apiVersion}`;
  }

  private get headers(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data as T;
  }

  // ─── Products ───

  async getProducts(limit = 50, cursor?: string): Promise<{ products: unknown[]; nextCursor?: string }> {
    let endpoint = `/products.json?limit=${limit}&status=any`;
    if (cursor) endpoint += `&page_info=${cursor}`;

    const data = await this.request<{ products: unknown[] }>(endpoint);
    return { products: data.products };
  }

  async getProduct(productId: number): Promise<unknown> {
    const data = await this.request<{ product: unknown }>(`/products/${productId}.json`);
    return data.product;
  }

  async createProduct(productData: Record<string, unknown>): Promise<unknown> {
    const data = await this.request<{ product: unknown }>('/products.json', {
      method: 'POST',
      body: JSON.stringify({ product: productData }),
    });
    return data.product;
  }

  async updateProduct(productId: number, productData: Record<string, unknown>): Promise<unknown> {
    const data = await this.request<{ product: unknown }>(`/products/${productId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ product: productData }),
    });
    return data.product;
  }

  async deleteProduct(productId: number): Promise<void> {
    await this.request(`/products/${productId}.json`, { method: 'DELETE' });
  }

  // ─── Orders ───

  async getOrders(limit = 50, status = 'any', cursor?: string): Promise<{ orders: unknown[]; nextCursor?: string }> {
    let endpoint = `/orders.json?limit=${limit}&status=${status}`;
    if (cursor) endpoint += `&page_info=${cursor}`;

    const data = await this.request<{ orders: unknown[] }>(endpoint);
    return { orders: data.orders };
  }

  async getOrder(orderId: number): Promise<unknown> {
    const data = await this.request<{ order: unknown }>(`/orders/${orderId}.json`);
    return data.order;
  }

  async createFulfillment(
    orderId: number,
    fulfillmentData: Record<string, unknown>
  ): Promise<unknown> {
    const data = await this.request<{ fulfillment: unknown }>(
      `/orders/${orderId}/fulfillments.json`,
      {
        method: 'POST',
        body: JSON.stringify({ fulfillment: fulfillmentData }),
      }
    );
    return data.fulfillment;
  }

  // ─── Inventory ───

  async getInventoryLevels(locationId: number): Promise<unknown[]> {
    const data = await this.request<{ inventory_levels: unknown[] }>(
      `/inventory_levels.json?location_ids=${locationId}`
    );
    return data.inventory_levels;
  }

  async adjustInventoryLevel(
    locationId: number,
    inventoryItemId: number,
    adjustBy: number
  ): Promise<void> {
    await this.request('/inventory_levels/adjust.json', {
      method: 'POST',
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available_adjustment: adjustBy,
      }),
    });
  }

  // ─── Locations ───

  async getLocations(): Promise<unknown[]> {
    const data = await this.request<{ locations: unknown[] }>('/locations.json');
    return data.locations;
  }

  // ─── Store Info ───

  async getShopInfo(): Promise<Record<string, unknown>> {
    const data = await this.request<{ shop: Record<string, unknown> }>('/shop.json');
    return data.shop;
  }

  // ─── Webhooks ───

  async createWebhook(topic: string, address: string): Promise<unknown> {
    const data = await this.request<{ webhook: unknown }>('/webhooks.json', {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          topic,
          address,
          format: 'json',
        },
      }),
    });
    return data.webhook;
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.request(`/webhooks/${webhookId}.json`, { method: 'DELETE' });
  }
}

// ─── Shopify OAuth ───

export function buildShopifyAuthUrl(shop: string, redirectUri: string, scopes: string[]): string {
  const clientId = process.env.SHOPIFY_CLIENT_ID || '';
  const scope = scopes.join(',');
  return `https://${shop}.myshopify.com/admin/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_options[]=per-user`;
}

export async function exchangeShopifyAuthCode(
  shop: string,
  code: string
): Promise<{ accessToken: string; scopes: string }> {
  const clientId = process.env.SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || '';

  const response = await fetch(
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify OAuth error: ${text}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token as string,
    scopes: data.scope as string,
  };
}

// ─── Data Normalization ───

function normalizeProduct(shopifyProduct: Record<string, unknown>): Record<string, unknown> {
  const variants = (shopifyProduct.variants as Record<string, unknown>[]) || [];
  const firstVariant = variants[0] || {};
  const images = (shopifyProduct.images as Record<string, unknown>[]) || [];

  return {
    name: shopifyProduct.title as string,
    description: shopifyProduct.body_html as string,
    sku: (firstVariant.sku as string) || null,
    price: firstVariant.price ? parseFloat(firstVariant.price as string) : null,
    comparePrice: firstVariant.compare_at_price
      ? parseFloat(firstVariant.compare_at_price as string)
      : null,
    imageUrl: (images[0]?.src as string) || null,
    galleryUrls: images.length > 0 ? JSON.stringify(images.map((i) => i.src)) : null,
    sourcePlatform: 'shopify',
    sourceId: String(shopifyProduct.id),
    storeProductId: String(shopifyProduct.id),
    tags: shopifyProduct.tags ? JSON.stringify((shopifyProduct.tags as string).split(', ')) : null,
    status: shopifyProduct.status === 'active' ? 'imported' : 'archived',
  };
}

function normalizeOrder(shopifyOrder: Record<string, unknown>): Record<string, unknown> {
  const shippingLines = (shopifyOrder.shipping_lines as Record<string, unknown>[]) || [];
  const shippingAddress = shopifyOrder.shipping_address as Record<string, unknown> | null;

  return {
    orderNumber: String(shopifyOrder.order_number),
    platformOrderId: String(shopifyOrder.id),
    platform: 'shopify',
    customerName: shippingAddress?.name as string || null,
    customerEmail: shopifyOrder.email as string || null,
    subtotal: shopifyOrder.subtotal_price
      ? parseFloat(shopifyOrder.subtotal_price as string)
      : 0,
    shippingCost: shippingLines.reduce(
      (sum: number, l: Record<string, unknown>) => sum + parseFloat((l.price as string) || '0'),
      0
    ),
    tax: shopifyOrder.total_tax ? parseFloat(shopifyOrder.total_tax as string) : 0,
    total: shopifyOrder.total_price ? parseFloat(shopifyOrder.total_price as string) : 0,
    currency: (shopifyOrder.currency as string) || 'USD',
    discount: shopifyOrder.total_discounts
      ? parseFloat(shopifyOrder.total_discounts as string)
      : 0,
    status: mapShopifyOrderStatus(shopifyOrder.fulfillment_status as string | null, shopifyOrder.financial_status as string | null),
    fulfillmentStatus: (shopifyOrder.fulfillment_status as string) || 'unfulfilled',
    shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
    shippingMethod: shippingLines[0]?.title as string || null,
    confirmedAt: new Date(shopifyOrder.created_at as string),
    tags: shopifyOrder.tags ? JSON.stringify((shopifyOrder.tags as string).split(', ')) : null,
  };
}

function mapShopifyOrderStatus(
  fulfillmentStatus: string | null,
  financialStatus: string | null
): string {
  if (financialStatus === 'refunded' || financialStatus === 'partially_refunded') return 'returned';
  if (financialStatus === 'voided') return 'cancelled';
  if (fulfillmentStatus === 'fulfilled') return 'delivered';
  if (fulfillmentStatus === 'partial') return 'processing';
  if (fulfillmentStatus === 'restocked') return 'cancelled';
  return 'confirmed';
}

// ─── Shopify Integration Service ───

export class ShopifyIntegration {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  async connectStore(
    shop: string,
    accessToken: string,
    name?: string
  ): Promise<{ integrationId: string; storeId: string }> {
    // Create or update integration
    let integration = await db.integration.findFirst({
      where: {
        workspaceId: this.workspaceId,
        provider: 'shopify',
        config: { contains: shop },
      },
    });

    if (integration) {
      integration = await db.integration.update({
        where: { id: integration.id },
        data: {
          accessToken,
          connectionStatus: 'connected',
          healthStatus: 'healthy',
          healthScore: 100,
          lastConnectedAt: new Date(),
          config: JSON.stringify({ shop }),
        },
      });
    } else {
      integration = await db.integration.create({
        data: {
          workspaceId: this.workspaceId,
          provider: 'shopify',
          name: name || `${shop} Store`,
          accessToken,
          connectionStatus: 'connected',
          healthStatus: 'healthy',
          healthScore: 100,
          lastConnectedAt: new Date(),
          config: JSON.stringify({ shop }),
        },
      });
    }

    // Create or update store record
    let store = await db.store.findFirst({
      where: {
        workspaceId: this.workspaceId,
        platform: 'shopify',
        platformUrl: `https://${shop}.myshopify.com`,
      },
    });

    if (store) {
      store = await db.store.update({
        where: { id: store.id },
        data: {
          accessToken,
          status: 'connected',
          lastSyncAt: new Date(),
          name: name || store.name,
        },
      });
    } else {
      store = await db.store.create({
        data: {
          workspaceId: this.workspaceId,
          name: name || `${shop} Store`,
          platform: 'shopify',
          platformUrl: `https://${shop}.myshopify.com`,
          platformId: shop,
          accessToken,
          status: 'connected',
          lastSyncAt: new Date(),
        },
      });
    }

    return { integrationId: integration.id, storeId: store.id };
  }

  async syncProducts(integrationId: string, storeId: string): Promise<{ synced: number; errors: number }> {
    const integration = await db.integration.findFirst({
      where: { id: integrationId, workspaceId: this.workspaceId },
    });
    if (!integration?.config) throw new Error('Integration config not found');

    const config = JSON.parse(integration.config) as Record<string, string>;
    const shop = config.shop;
    if (!integration.accessToken) throw new Error('No access token');

    const client = new ShopifyClient(shop, integration.accessToken);
    let synced = 0;
    let errors = 0;

    try {
      const { products } = await client.getProducts(250);
      for (const shopifyProduct of products) {
        try {
          const productData = normalizeProduct(shopifyProduct as Record<string, unknown>);
          const existing = await db.product.findFirst({
            where: {
              workspaceId: this.workspaceId,
              sourcePlatform: 'shopify',
              sourceId: productData.sourceId as string,
            },
          });

          if (existing) {
            await db.product.update({
              where: { id: existing.id },
              data: productData as any,
            });
          } else {
            await db.product.create({
              data: {
                workspaceId: this.workspaceId,
                ...productData,
              } as any,
            });
          }
          synced++;
        } catch {
          errors++;
        }
      }

      // Update store product count
      const productCount = await db.product.count({
        where: { workspaceId: this.workspaceId, sourcePlatform: 'shopify' },
      });
      await db.store.update({
        where: { id: storeId },
        data: { totalProducts: productCount, lastSyncAt: new Date() },
      });

      const eventBus = getEventBus();
      await eventBus.emit({
        workspaceId: this.workspaceId,
        eventType: 'shopify.products.synced',
        source: 'shopify-integration',
        level: 'info',
        payload: { storeId, synced, errors },
        resourceType: 'store',
        resourceId: storeId,
      });
    } catch (error) {
      await db.store.update({
        where: { id: storeId },
        data: { syncStatus: 'error', syncError: error instanceof Error ? error.message : 'Sync failed' },
      });
      throw error;
    }

    return { synced, errors };
  }

  async syncOrders(integrationId: string, storeId: string): Promise<{ synced: number; errors: number }> {
    const integration = await db.integration.findFirst({
      where: { id: integrationId, workspaceId: this.workspaceId },
    });
    if (!integration?.config) throw new Error('Integration config not found');

    const config = JSON.parse(integration.config) as Record<string, string>;
    const shop = config.shop;
    if (!integration.accessToken) throw new Error('No access token');

    const client = new ShopifyClient(shop, integration.accessToken);
    let synced = 0;
    let errors = 0;

    try {
      const { orders } = await client.getOrders(250);
      for (const shopifyOrder of orders) {
        try {
          const orderData = normalizeOrder(shopifyOrder as Record<string, unknown>);
          const existing = await db.order.findFirst({
            where: {
              workspaceId: this.workspaceId,
              platformOrderId: orderData.platformOrderId as string,
            },
          });

          if (existing) {
            await db.order.update({
              where: { id: existing.id },
              data: { ...orderData, storeId } as any,
            });
          } else {
            await db.order.create({
              data: {
                workspaceId: this.workspaceId,
                storeId,
                ...orderData,
              } as any,
            });
          }
          synced++;
        } catch {
          errors++;
        }
      }

      // Update store order count
      const orderCount = await db.order.count({
        where: { workspaceId: this.workspaceId, storeId },
      });
      const totalRevenue = await db.order.aggregate({
        where: { workspaceId: this.workspaceId, storeId },
        _sum: { total: true },
      });
      await db.store.update({
        where: { id: storeId },
        data: {
          totalOrders: orderCount,
          totalRevenue: totalRevenue._sum.total || 0,
          lastSyncAt: new Date(),
        },
      });

      const eventBus = getEventBus();
      await eventBus.emit({
        workspaceId: this.workspaceId,
        eventType: 'shopify.orders.synced',
        source: 'shopify-integration',
        level: 'info',
        payload: { storeId, synced, errors },
        resourceType: 'store',
        resourceId: storeId,
      });
    } catch (error) {
      throw error;
    }

    return { synced, errors };
  }

  async syncAll(integrationId: string, storeId: string): Promise<Record<string, { synced: number; errors: number }>> {
    const [products, orders] = await Promise.allSettled([
      this.syncProducts(integrationId, storeId),
      this.syncOrders(integrationId, storeId),
    ]);

    return {
      products: products.status === 'fulfilled' ? products.value : { synced: 0, errors: 0 },
      orders: orders.status === 'fulfilled' ? orders.value : { synced: 0, errors: 0 },
    };
  }

  async createFulfillment(
    storeId: string,
    orderId: string,
    trackingNumber: string,
    carrier: string,
    trackingUrl?: string
  ): Promise<void> {
    const store = await db.store.findFirst({
      where: { id: storeId, workspaceId: this.workspaceId },
    });
    if (!store?.accessToken || !store.platformUrl) throw new Error('Store not connected');

    const shop = store.platformUrl.replace('https://', '').replace('.myshopify.com', '');
    const client = new ShopifyClient(shop, store.accessToken);

    const order = await db.order.findFirst({
      where: { id: orderId, workspaceId: this.workspaceId },
    });
    if (!order?.platformOrderId) throw new Error('Order not found or not synced');

    const fulfillmentData: Record<string, unknown> = {
      tracking_number: trackingNumber,
      tracking_url: trackingUrl || '',
      carrier: carrier.toLowerCase(),
      line_items: [],
      notify_customer: true,
    };

    const items = await db.orderItem.findMany({ where: { orderId } });
    fulfillmentData.line_items = items.map((item) => ({ id: Number(item.id) }));

    await client.createFulfillment(Number(order.platformOrderId), fulfillmentData);

    await db.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: 'fulfilled',
        trackingNumber,
        trackingUrl: trackingUrl || null,
        carrier,
        shippedAt: new Date(),
        autoFulfilled: true,
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'shopify.fulfillment.created',
      source: 'shopify-integration',
      level: 'info',
      payload: { orderId, trackingNumber, carrier },
      resourceType: 'order',
      resourceId: orderId,
    });
  }

  async registerWebhooks(integrationId: string, webhookBaseUrl: string): Promise<void> {
    const integration = await db.integration.findFirst({
      where: { id: integrationId, workspaceId: this.workspaceId },
    });
    if (!integration?.config) throw new Error('Integration config not found');

    const config = JSON.parse(integration.config) as Record<string, string>;
    const shop = config.shop;
    if (!integration.accessToken) throw new Error('No access token');

    const client = new ShopifyClient(shop, integration.accessToken);
    const topics = [
      'orders/create',
      'orders/updated',
      'orders/fulfilled',
      'products/create',
      'products/update',
      'app/uninstalled',
    ];

    const webhookUrl = `${webhookBaseUrl}/api/commerce/integrations/${integrationId}/webhooks/shopify`;

    for (const topic of topics) {
      try {
        await client.createWebhook(topic, webhookUrl);
      } catch {
        // Webhook may already exist — skip
      }
    }
  }

  async handleWebhook(integrationId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const integration = await db.integration.findFirst({
      where: { id: integrationId, workspaceId: this.workspaceId },
    });
    if (!integration) throw new Error('Integration not found');

    const store = await db.store.findFirst({
      where: { workspaceId: this.workspaceId, platform: 'shopify' },
    });
    if (!store) throw new Error('Store not found');

    switch (eventType) {
      case 'orders/create':
      case 'orders/updated': {
        const normalized = normalizeOrder(payload as Record<string, unknown>);
        const existing = await db.order.findFirst({
          where: { workspaceId: this.workspaceId, platformOrderId: normalized.platformOrderId as string },
        });

        if (existing) {
          await db.order.update({ where: { id: existing.id }, data: { ...normalized, storeId: store.id } as any });
        } else {
          await db.order.create({ data: { workspaceId: this.workspaceId, storeId: store.id, ...normalized } as any });
        }
        break;
      }
      case 'products/create':
      case 'products/update': {
        const normalized = normalizeProduct(payload as Record<string, unknown>);
        const existing = await db.product.findFirst({
          where: { workspaceId: this.workspaceId, sourcePlatform: 'shopify', sourceId: normalized.sourceId as string },
        });

        if (existing) {
          await db.product.update({ where: { id: existing.id }, data: normalized as any });
        } else {
          await db.product.create({ data: { workspaceId: this.workspaceId, ...normalized } as any });
        }
        break;
      }
      case 'app/uninstalled': {
        await db.integration.update({
          where: { id: integrationId },
          data: { connectionStatus: 'disconnected', healthStatus: 'error' },
        });
        await db.store.update({
          where: { id: store.id },
          data: { status: 'disconnected', syncStatus: 'error', syncError: 'App uninstalled' },
        });
        break;
      }
      default:
        break;
    }
  }
}

// ─── Shopify Provider Adapter ───

const shopifyAdapter: ProviderAdapter = {
  provider: 'shopify',
  name: 'Shopify',

  async connect(config: Record<string, unknown>) {
    const shop = config.shop as string;
    const accessToken = config.accessToken as string;
    return {
      accessToken,
      metadata: { shop },
    };
  },

  async disconnect() {
    // Cleanup is handled at the integration level
  },

  async validateConnection(integration: IntegrationConfig) {
    try {
      if (!integration.config) return { valid: false, healthScore: 0 };
      const config = JSON.parse(integration.config) as Record<string, string>;
      const shop = config.shop;
      if (!integration.accessToken) return { valid: false, healthScore: 0 };

      const client = new ShopifyClient(shop, integration.accessToken);
      const shopInfo = await client.getShopInfo();

      return {
        valid: true,
        healthScore: shopInfo ? 100 : 50,
        metadata: { shopName: shopInfo.name as string, email: shopInfo.email as string },
      };
    } catch {
      return { valid: false, healthScore: 0 };
    }
  },

  async sync(integration: IntegrationConfig, resource: string) {
    if (!integration.config) return { synced: 0, errors: 0, metadata: {} };
    const config = JSON.parse(integration.config) as Record<string, string>;
    const shop = config.shop;
    const client = new ShopifyClient(shop, integration.accessToken || '');

    let synced = 0;
    let errors = 0;

    if (resource === 'products' || resource === 'all') {
      const { products } = await client.getProducts(250);
      for (const product of products) {
        try {
          const normalized = normalizeProduct(product as Record<string, unknown>);
          const existing = await db.product.findFirst({
            where: { workspaceId: integration.workspaceId, sourcePlatform: 'shopify', sourceId: normalized.sourceId as string },
          });

          if (existing) {
            await db.product.update({ where: { id: existing.id }, data: normalized as any });
          } else {
            await db.product.create({ data: { workspaceId: integration.workspaceId, ...normalized } as any });
          }
          synced++;
        } catch {
          errors++;
        }
      }
    }

    if (resource === 'orders' || resource === 'all') {
      const { orders } = await client.getOrders(250);
      for (const order of orders) {
        try {
          const normalized = normalizeOrder(order as Record<string, unknown>);
          const existing = await db.order.findFirst({
            where: { workspaceId: integration.workspaceId, platformOrderId: normalized.platformOrderId as string },
          });

          if (existing) {
            await db.order.update({ where: { id: existing.id }, data: normalized as any });
          } else {
            await db.order.create({ data: { workspaceId: integration.workspaceId, ...normalized } as any });
          }
          synced++;
        } catch {
          errors++;
        }
      }
    }

    return { synced, errors, metadata: { shop, resource } };
  },

  async webhookHandler(integration: IntegrationConfig, event: string, payload: unknown) {
    const payloadRecord = payload as Record<string, unknown>;
    const shopifyService = new ShopifyIntegration(integration.workspaceId);
    const integrationRecord = await db.integration.findFirst({ where: { id: integration.id } });

    if (integrationRecord) {
      await shopifyService.handleWebhook(integration.id, event, payloadRecord);
    }
  },
};

// Register the Shopify adapter
registerProviderAdapter(shopifyAdapter);
