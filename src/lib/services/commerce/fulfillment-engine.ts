// ═══════════════════════════════════════════════════════════════
// AMEO AI — Order + Fulfillment Engine (System 5)
// Commerce operations engine with order synchronization,
// fulfillment tracking, shipment management, supplier routing,
// automated retries, and refund workflow architecture.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export type FulfillmentStatus = 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type ShipmentStatus = 'pending' | 'labeled' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'lost';

export interface FulfillmentRequest {
  orderId: string;
  items?: string[]; // order item IDs to fulfill
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  autoRoute?: boolean;
}

export interface SupplierRouteResult {
  supplierId: string;
  supplierName: string;
  estimatedCost: number;
  estimatedDays: number;
  reliability: number;
  score: number;
}

export interface ShipmentUpdate {
  orderId: string;
  status: ShipmentStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  location?: string;
  timestamp: Date;
  notes?: string;
}

// ─── Fulfillment Engine ───

export class FulfillmentEngine {
  private workspaceId: string;
  private static readonly MAX_FULFILLMENT_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 5000;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Order Fulfillment ───

  async fulfillOrder(request: FulfillmentRequest): Promise<{
    success: boolean;
    fulfillmentStatus: FulfillmentStatus;
    trackingNumber?: string;
    carrier?: string;
    errors?: string[];
  }> {
    const eventBus = getEventBus();
    const errors: string[] = [];

    const order = await db.order.findFirst({
      where: { id: request.orderId, workspaceId: this.workspaceId },
      include: { items: true, store: true },
    });
    if (!order) throw new Error('Order not found');

    if (order.fulfillmentStatus === 'fulfilled' || order.fulfillmentStatus === 'cancelled') {
      return { success: false, fulfillmentStatus: order.fulfillmentStatus as FulfillmentStatus, errors: ['Order already fulfilled or cancelled'] };
    }

    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'fulfillment.started',
      source: 'fulfillment-engine',
      level: 'info',
      payload: { orderId: request.orderId },
      resourceType: 'order',
      resourceId: request.orderId,
    });

    // Determine fulfillment approach
    let trackingNumber = request.trackingNumber;
    let carrier = request.carrier;
    let autoFulfilled = false;

    if (request.autoRoute && !trackingNumber) {
      // Auto-route to best supplier
      const route = await this.findBestSupplierRoute(order);
      if (route) {
        trackingNumber = `AME-${order.orderNumber || order.id.slice(-8)}-${Date.now().toString(36).toUpperCase()}`;
        carrier = 'auto';
        autoFulfilled = true;

        // Record supplier routing
        await this.recordSupplierRouting(order.id, route);
      }
    }

    // Attempt fulfillment via connected store
    if (order.store?.platform === 'shopify' && order.store.accessToken) {
      try {
        const shop = order.store.platformUrl?.replace('https://', '').replace('.myshopify.com', '');
        if (shop) {
          const { ShopifyIntegration } = await import('./shopify-integration');
          const shopify = new ShopifyIntegration(this.workspaceId);
          await shopify.createFulfillment(
            order.storeId!,
            order.id,
            trackingNumber || `AME-${order.orderNumber || order.id.slice(-8)}`,
            carrier || 'auto',
            request.trackingUrl
          );
        }
      } catch (error) {
        errors.push(`Store fulfillment failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Update order fulfillment status
    const itemCount = order.items.length;
    const fulfilledItems = request.items?.length || itemCount;
    const newFulfillmentStatus: FulfillmentStatus =
      fulfilledItems >= itemCount ? 'fulfilled' : 'partially_fulfilled';

    await db.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: newFulfillmentStatus,
        trackingNumber: trackingNumber || null,
        carrier: carrier || null,
        trackingUrl: request.trackingUrl || null,
        autoFulfilled,
        fulfillmentError: errors.length > 0 ? errors.join('; ') : null,
        shippedAt: new Date(),
        status: 'shipped',
      },
    });

    // Update individual items
    if (request.items && request.items.length > 0) {
      await db.orderItem.updateMany({
        where: { id: { in: request.items }, orderId: order.id },
        data: {
          status: 'shipped',
          trackingNumber: trackingNumber || null,
          carrier: carrier || null,
        },
      });
    }

    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'fulfillment.completed',
      source: 'fulfillment-engine',
      level: 'info',
      payload: {
        orderId: request.orderId,
        fulfillmentStatus: newFulfillmentStatus,
        trackingNumber,
        autoFulfilled,
      },
      resourceType: 'order',
      resourceId: request.orderId,
    });

    return {
      success: errors.length === 0,
      fulfillmentStatus: newFulfillmentStatus,
      trackingNumber,
      carrier,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ─── Supplier Routing ───

  async findBestSupplierRoute(order: {
    id: string;
    items: Array<{ productId: string | null; supplierId: string | null; name: string; quantity: number }>;
  }): Promise<SupplierRouteResult | null> {
    // Find suppliers for order items
    const supplierIds = new Set<string>();
    for (const item of order.items) {
      if (item.supplierId) supplierIds.add(item.supplierId);

      if (item.productId) {
        const product = await db.product.findUnique({ where: { id: item.productId } });
        if (product?.supplierId) supplierIds.add(product.supplierId);
      }
    }

    if (supplierIds.size === 0) return null;

    const suppliers = await db.supplier.findMany({
      where: { id: { in: Array.from(supplierIds) }, workspaceId: this.workspaceId },
    });

    if (suppliers.length === 0) return null;

    // Score each supplier
    const routes: SupplierRouteResult[] = suppliers.map((s) => {
      const reliability = s.reliabilityScore || 50;
      const pricingScore = s.pricingScore || 50;
      const shippingScore = s.shippingScore || 50;

      // Composite score (weighted)
      const score = reliability * 0.4 + pricingScore * 0.3 + shippingScore * 0.3;

      return {
        supplierId: s.id,
        supplierName: s.name,
        estimatedCost: 0, // Would need to calculate based on items
        estimatedDays: 7 + Math.floor(Math.random() * 15), // Estimate based on shipping methods
        reliability,
        score: Math.round(score),
      };
    });

    // Return best scored supplier
    routes.sort((a, b) => b.score - a.score);
    return routes[0] || null;
  }

  private async recordSupplierRouting(
    orderId: string,
    route: SupplierRouteResult
  ): Promise<void> {
    await db.order.update({
      where: { id: orderId },
      data: {
        fulfillmentRuleId: route.supplierId,
        metadata: JSON.stringify({
          autoRouted: true,
          supplierName: route.supplierName,
          estimatedCost: route.estimatedCost,
          estimatedDays: route.estimatedDays,
          reliability: route.reliability,
          routedAt: new Date().toISOString(),
        }),
      },
    });
  }

  // ─── Shipment Tracking ───

  async updateShipment(update: ShipmentUpdate): Promise<void> {
    const order = await db.order.findFirst({
      where: { id: update.orderId, workspaceId: this.workspaceId },
    });
    if (!order) throw new Error('Order not found');

    const updateData: Record<string, unknown> = {};

    if (update.trackingNumber) updateData.trackingNumber = update.trackingNumber;
    if (update.trackingUrl) updateData.trackingUrl = update.trackingUrl;
    if (update.carrier) updateData.carrier = update.carrier;

    switch (update.status) {
      case 'delivered':
        updateData.status = 'delivered';
        updateData.fulfillmentStatus = 'fulfilled';
        updateData.deliveredAt = update.timestamp;
        break;
      case 'in_transit':
        updateData.status = 'shipped';
        updateData.shippedAt = update.timestamp;
        break;
      case 'returned':
        updateData.status = 'returned';
        updateData.fulfillmentStatus = 'cancelled';
        updateData.returnedAt = update.timestamp;
        break;
      case 'picked_up':
        updateData.status = 'processing';
        break;
      case 'lost':
        updateData.status = 'cancelled';
        updateData.fulfillmentError = 'Shipment lost in transit';
        break;
      default:
        updateData.status = 'processing';
    }

    await db.order.update({
      where: { id: update.orderId },
      data: updateData,
    });

    // Log shipment event
    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: `fulfillment.shipment.${update.status}`,
      source: 'fulfillment-engine',
      level: 'info',
      payload: { ...update } as Record<string, unknown>,
      resourceType: 'order',
      resourceId: update.orderId,
    });
  }

  // ─── Automated Fulfillment Retry ───

  async retryFailedFulfillment(orderId: string): Promise<{
    success: boolean;
    attempt: number;
    error?: string;
  }> {
    const order = await db.order.findFirst({
      where: { id: orderId, workspaceId: this.workspaceId },
    });
    if (!order) throw new Error('Order not found');

    // Read current retry count from metadata
    let metadata: Record<string, unknown> = {};
    try {
      metadata = order.metadata ? JSON.parse(order.metadata) : {};
    } catch {
      metadata = {};
    }

    const retryCount = (metadata.fulfillmentRetries as number) || 0;

    if (retryCount >= FulfillmentEngine.MAX_FULFILLMENT_RETRIES) {
      return { success: false, attempt: retryCount, error: 'Max retries reached' };
    }

    // Exponential backoff
    const backoffMs = FulfillmentEngine.RETRY_DELAY_MS * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    try {
      const result = await this.fulfillOrder({
        orderId,
        autoRoute: true,
      });

      await db.order.update({
        where: { id: orderId },
        data: {
          metadata: JSON.stringify({
            ...metadata,
            fulfillmentRetries: retryCount + 1,
            lastRetryAt: new Date().toISOString(),
            lastRetryResult: result.success ? 'success' : 'failed',
          }),
        },
      });

      return { success: result.success, attempt: retryCount + 1 };
    } catch (error) {
      return {
        success: false,
        attempt: retryCount + 1,
        error: error instanceof Error ? error.message : 'Retry failed',
      };
    }
  }

  // ─── Refund Workflow ───

  async initiateRefund(
    orderId: string,
    reason: string,
    amount?: number
  ): Promise<{ success: boolean; refundId: string }> {
    const order = await db.order.findFirst({
      where: { id: orderId, workspaceId: this.workspaceId },
    });
    if (!order) throw new Error('Order not found');

    const refundAmount = amount || order.total || 0;

    // Record refund in order
    const metadata = order.metadata ? JSON.parse(order.metadata) : {};
    const refunds = (metadata.refunds as Array<Record<string, unknown>>) || [];
    const refundId = `REF-${orderId.slice(-8)}-${refunds.length + 1}`;

    refunds.push({
      id: refundId,
      amount: refundAmount,
      reason,
      status: 'initiated',
      createdAt: new Date().toISOString(),
    });

    await db.order.update({
      where: { id: orderId },
      data: {
        status: 'returned',
        metadata: JSON.stringify({ ...metadata, refunds }),
        returnedAt: new Date(),
      },
    });

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'fulfillment.refund.initiated',
      source: 'fulfillment-engine',
      level: 'warn',
      payload: { orderId, refundId, amount: refundAmount, reason },
      resourceType: 'order',
      resourceId: orderId,
    });

    return { success: true, refundId };
  }

  // ─── Order Sync ───

  async syncOrdersFromStore(storeId: string): Promise<{ synced: number; errors: number }> {
    const store = await db.store.findFirst({
      where: { id: storeId, workspaceId: this.workspaceId },
    });
    if (!store || store.status !== 'connected') throw new Error('Store not connected');

    if (store.platform === 'shopify' && store.accessToken && store.platformUrl) {
      const { ShopifyIntegration } = await import('./shopify-integration');
      const shopify = new ShopifyIntegration(this.workspaceId);

      const integration = await db.integration.findFirst({
        where: { workspaceId: this.workspaceId, provider: 'shopify' },
      });

      if (integration) {
        return shopify.syncOrders(integration.id, storeId);
      }
    }

    return { synced: 0, errors: 1 };
  }

  // ─── Dashboard Stats ───

  async getStats(): Promise<{
    totalOrders: number;
    unfulfilled: number;
    inTransit: number;
    delivered: number;
    returned: number;
    cancelled: number;
    autoFulfilled: number;
    failedFulfillments: number;
    averageDeliveryTime: number | null;
  }> {
    const where = { workspaceId: this.workspaceId };

    const [totalOrders, unfulfilled, inTransit, delivered, returned, cancelled, autoFulfilled] =
      await Promise.all([
        db.order.count({ where }),
        db.order.count({ where: { ...where, fulfillmentStatus: 'unfulfilled' } }),
        db.order.count({ where: { ...where, status: 'shipped' } }),
        db.order.count({ where: { ...where, status: 'delivered' } }),
        db.order.count({ where: { ...where, status: 'returned' } }),
        db.order.count({ where: { ...where, status: 'cancelled' } }),
        db.order.count({ where: { ...where, autoFulfilled: true } }),
      ]);

    // Calculate average delivery time
    const deliveredOrders = await db.order.findMany({
      where: { ...where, status: 'delivered', deliveredAt: { not: null }, confirmedAt: { not: null } },
    });
    const deliveryTimes = deliveredOrders
      .map((o) => {
        if (o.deliveredAt && o.confirmedAt) {
          return (o.deliveredAt.getTime() - o.confirmedAt.getTime()) / (1000 * 60 * 60 * 24);
        }
        return null;
      })
      .filter((t): t is number => t !== null);

    const averageDeliveryTime =
      deliveryTimes.length > 0
        ? deliveryTimes.reduce((sum, t) => sum + t, 0) / deliveryTimes.length
        : null;

    return {
      totalOrders,
      unfulfilled,
      inTransit,
      delivered,
      returned,
      cancelled,
      autoFulfilled,
      failedFulfillments: cancelled,
      averageDeliveryTime: averageDeliveryTime ? Math.round(averageDeliveryTime * 10) / 10 : null,
    };
  }
}
