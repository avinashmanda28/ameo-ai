// ═══════════════════════════════════════════════════════════════
// AMEO AI — Commerce Analytics Service (Commerce System 6)
// Revenue intelligence, operational efficiency, performance metrics
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export type AnalyticPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecordAnalyticParams {
  workspaceId: string;
  metricType: string;
  period: AnalyticPeriod;
  value: number;
  previousValue?: number;
  breakdown?: Record<string, unknown>;
  productId?: string;
  storeId?: string;
  agentId?: string;
}

export interface RevenueAnalytics {
  period: AnalyticPeriod;
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueByDay: Array<{ date: string; revenue: number; profit: number; orders: number }>;
  revenueByStore: Array<{ storeId: string; storeName: string; revenue: number; orders: number }>;
  revenueByProduct: Array<{ productId: string; productName: string; revenue: number; unitsSold: number }>;
  trending: 'up' | 'stable' | 'down';
  changePercent: number;
}

export interface OperationalEfficiency {
  fulfillmentRate: number;
  averageFulfillmentTime: number; // hours
  automationRate: number; // percentage of orders auto-fulfilled
  errorRate: number;
  activeRules: number;
  rulesExecuted: number;
  syncLatency: number; // minutes
  storeHealth: Array<{ storeId: string; storeName: string; status: string; lastSync: string | null }>;
}

export interface DashboardMetrics {
  revenue: {
    total: number;
    change: number;
    period: string;
  };
  products: {
    total: number;
    analyzed: number;
    imported: number;
  };
  orders: {
    total: number;
    pending: number;
    fulfilled: number;
  };
  suppliers: {
    total: number;
    verified: number;
    active: number;
  };
  trends: {
    total: number;
    active: number;
    buyRecommendations: number;
  };
  stores: {
    total: number;
    connected: number;
    disconnected: number;
  };
}

// ─── CommerceAnalytics Class ───

export class CommerceAnalytics {
  /**
   * Record a new analytic metric.
   */
  async recordMetric(params: RecordAnalyticParams): Promise<{ id: string }> {
    const now = new Date();
    const { periodStart, periodEnd } = this.computePeriodRange(now, params.period);

    const analytic = await db.commerceAnalytic.create({
      data: {
        workspaceId: params.workspaceId,
        metricType: params.metricType,
        period: params.period,
        periodStart,
        periodEnd,
        value: params.value,
        previousValue: params.previousValue || null,
        changePercent: params.previousValue
          ? ((params.value - params.previousValue) / params.previousValue) * 100
          : null,
        breakdown: params.breakdown ? JSON.stringify(params.breakdown) : null,
        productId: params.productId || null,
        storeId: params.storeId || null,
        agentId: params.agentId || null,
      },
    });

    return { id: analytic.id };
  }

  /**
   * Get revenue analytics for a workspace.
   */
  async getRevenueAnalytics(workspaceId: string, period: AnalyticPeriod = 'monthly'): Promise<RevenueAnalytics> {
    const periodStart = this.getPeriodStart(period);

    // Get revenue metrics from analytics records
    const revenueMetrics = await db.commerceAnalytic.findMany({
      where: {
        workspaceId,
        metricType: { in: ['revenue', 'profit', 'orders'] },
        periodStart: { gte: periodStart },
      },
      orderBy: { periodStart: 'asc' },
    });

    // Get recent orders for revenue calculation
    const recentOrders = await db.order.findMany({
      where: {
        workspaceId,
        createdAt: { gte: periodStart },
      },
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { id: true, name: true } } },
    });

    const totalRevenue = recentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = recentOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by day
    const revenueByDayMap = new Map<string, { revenue: number; profit: number; orders: number }>();
    for (const order of recentOrders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const existing = revenueByDayMap.get(dateKey) || { revenue: 0, profit: 0, orders: 0 };
      existing.revenue += order.total || 0;
      existing.profit += (order.profitEstimate || 0);
      existing.orders += 1;
      revenueByDayMap.set(dateKey, existing);
    }
    const revenueByDay = Array.from(revenueByDayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Revenue by store
    const revenueByStoreMap = new Map<string, { storeId: string; storeName: string; revenue: number; orders: number }>();
    for (const order of recentOrders) {
      const storeId = order.storeId || 'unknown';
      const storeName = order.store?.name || 'Unknown Store';
      const existing = revenueByStoreMap.get(storeId) || { storeId, storeName, revenue: 0, orders: 0 };
      existing.revenue += order.total || 0;
      existing.orders += 1;
      revenueByStoreMap.set(storeId, existing);
    }
    const revenueByStore = Array.from(revenueByStoreMap.values());

    // Revenue by product (from order items)
    const orderItems = await db.orderItem.findMany({
      where: {
        orderId: { in: recentOrders.map((o) => o.id) },
      },
      include: { product: { select: { id: true, name: true } } },
    });
    const revenueByProductMap = new Map<string, { productId: string; productName: string; revenue: number; unitsSold: number }>();
    for (const item of orderItems) {
      const productId = item.productId || 'unknown';
      const productName = item.product?.name || item.name;
      const existing = revenueByProductMap.get(productId) || { productId, productName, revenue: 0, unitsSold: 0 };
      existing.revenue += item.totalPrice || 0;
      existing.unitsSold += item.quantity;
      revenueByProductMap.set(productId, existing);
    }
    const revenueByProduct = Array.from(revenueByProductMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate trend
    const midpoint = Math.floor(revenueByDay.length / 2);
    const firstHalf = revenueByDay.slice(0, midpoint).reduce((s, d) => s + d.revenue, 0);
    const secondHalf = revenueByDay.slice(midpoint).reduce((s, d) => s + d.revenue, 0);
    const trending: 'up' | 'stable' | 'down' =
      secondHalf > firstHalf * 1.1 ? 'up'
        : secondHalf < firstHalf * 0.9 ? 'down' : 'stable';

    const previousPeriodStart = this.getPreviousPeriodStart(period);
    const previousOrders = await db.order.count({
      where: { workspaceId, createdAt: { gte: previousPeriodStart, lt: periodStart } },
    });
    const changePercent = previousOrders > 0
      ? ((totalOrders - previousOrders) / previousOrders) * 100
      : 0;

    return {
      period,
      totalRevenue,
      totalProfit: revenueByDay.reduce((s, d) => s + d.profit, 0),
      totalOrders,
      averageOrderValue,
      revenueByDay,
      revenueByStore,
      revenueByProduct,
      trending,
      changePercent: Math.round(changePercent * 10) / 10,
    };
  }

  /**
   * Get operational efficiency metrics.
   */
  async getOperationalEfficiency(workspaceId: string): Promise<OperationalEfficiency> {
    const totalOrders = await db.order.count({ where: { workspaceId } });
    const fulfilledOrders = await db.order.count({ where: { workspaceId, fulfillmentStatus: 'fulfilled' } });
    const autoFulfilled = await db.order.count({ where: { workspaceId, autoFulfilled: true } });

    // Calculate fulfillment time
    const fulfilledOrderRecords = await db.order.findMany({
      where: { workspaceId, shippedAt: { not: null } },
      select: { createdAt: true, shippedAt: true },
      take: 100,
    });
    const fulfillmentTimes = fulfilledOrderRecords
      .filter((o) => o.shippedAt)
      .map((o) => (o.shippedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60));
    const averageFulfillmentTime = fulfillmentTimes.length > 0
      ? fulfillmentTimes.reduce((a, b) => a + b, 0) / fulfillmentTimes.length
      : 0;

    // Automation stats
    const rules = await db.automationRule.findMany({ where: { workspaceId } });
    const activeRules = rules.filter((r) => r.enabled).length;
    const totalExecutions = rules.reduce((sum, r) => sum + r.runCount, 0);
    const errorRules = rules.filter((r) => r.failCount > 0).length;

    // Store health
    const stores = await db.store.findMany({
      where: { workspaceId },
      select: { id: true, name: true, status: true, lastSyncAt: true, syncStatus: true },
    });

    return {
      fulfillmentRate: totalOrders > 0 ? (fulfilledOrders / totalOrders) * 100 : 0,
      averageFulfillmentTime: Math.round(averageFulfillmentTime * 10) / 10,
      automationRate: fulfilledOrders > 0 ? (autoFulfilled / fulfilledOrders) * 100 : 0,
      errorRate: totalExecutions > 0 ? (errorRules / totalExecutions) * 100 : 0,
      activeRules,
      rulesExecuted: totalExecutions,
      syncLatency: 0,
      storeHealth: stores.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        status: s.syncStatus || s.status,
        lastSync: s.lastSyncAt?.toISOString() || null,
      })),
    };
  }

  /**
   * Get fulfillment metrics.
   */
  async getFulfillmentMetrics(workspaceId: string) {
    const orders = await db.order.findMany({ where: { workspaceId } });

    const statusCounts = {
      pending: orders.filter((o) => o.status === 'pending').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      processing: orders.filter((o) => o.status === 'processing').length,
      shipped: orders.filter((o) => o.status === 'shipped').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      returned: orders.filter((o) => o.status === 'returned').length,
    };

    const pendingShipment = orders.filter((o) =>
      ['pending', 'confirmed', 'processing'].includes(o.status)
    ).length;

    return {
      total: orders.length,
      ...statusCounts,
      pendingShipment,
      fulfillmentRate: orders.length > 0
        ? ((statusCounts.shipped + statusCounts.delivered) / orders.length) * 100
        : 0,
    };
  }

  /**
   * Get agent performance metrics.
   */
  async getAgentPerformance(workspaceId: string) {
    const agentMemories = await db.agentMemory.findMany({
      where: { workspaceId },
      select: { agentType: true, agentId: true },
      distinct: ['agentType'],
    });

    const agentTypes = [...new Set(agentMemories.map((m) => m.agentType))];

    const performance: Array<{ agentType: string; memories: number; analytics: number; status: string }> = [];
    for (const agentType of agentTypes) {
      const memories = await db.agentMemory.count({ where: { workspaceId, agentType } });
      const analytics = await db.commerceAnalytic.count({
        where: { workspaceId, agentId: { not: null }, metricType: 'agent_performance' },
      });

      performance.push({
        agentType,
        memories,
        analytics,
        status: 'active',
      });
    }

    return { agents: performance, totalAgents: agentTypes.length };
  }

  /**
   * Get supplier performance metrics.
   */
  async getSupplierPerformance(workspaceId: string) {
    const suppliers = await db.supplier.findMany({ where: { workspaceId } });

    const avgScore = suppliers.length > 0
      ? suppliers.reduce((s, su) => s + (su.overallScore || 0), 0) / suppliers.length
      : 0;

    const verifiedCount = suppliers.filter((s) => s.verifiedBadge).length;
    const highRisk = suppliers.filter((s) => (s.riskScore || 0) > 60).length;

    return {
      totalSuppliers: suppliers.length,
      verifiedSuppliers: verifiedCount,
      averageOverallScore: Math.round(avgScore * 10) / 10,
      averageTrustScore: suppliers.length > 0
        ? Math.round(suppliers.reduce((s, su) => s + (su.trustScore || 0), 0) / suppliers.length * 10) / 10
        : 0,
      highRiskSuppliers: highRisk,
      topPerformers: suppliers
        .filter((s) => (s.overallScore || 0) > 70)
        .map((s) => ({ id: s.id, name: s.name, score: s.overallScore })),
    };
  }

  /**
   * Get trend success rates.
   */
  async getTrendSuccessRates(workspaceId: string) {
    const trends = await db.trend.findMany({ where: { workspaceId } });

    const active = trends.filter((t) => t.status === 'active').length;
    const withProducts = trends.filter((t) => t.productId).length;
    const buyRecommendations = trends.filter((t) => t.aiRecommendation === 'buy').length;
    const avgScore = trends.length > 0
      ? trends.reduce((s, t) => s + (t.overallScore || 0), 0) / trends.length
      : 0;

    return {
      totalTrends: trends.length,
      activeTrends: active,
      trendsWithProducts: withProducts,
      buyRecommendations,
      averageScore: Math.round(avgScore * 10) / 10,
      conversionRate: trends.length > 0 ? (withProducts / trends.length) * 100 : 0,
    };
  }

  /**
   * Get the full analytics dashboard summary.
   */
  async getDashboard(workspaceId: string): Promise<DashboardMetrics> {
    const [
      productCount,
      analyzedCount,
      importedCount,
      totalOrders,
      pendingOrders,
      fulfilledOrders,
      totalSuppliers,
      verifiedSuppliers,
      totalTrends,
      activeTrends,
      buyTrends,
      totalStores,
      connectedStores,
      revenueMetrics,
    ] = await Promise.all([
      db.product.count({ where: { workspaceId } }),
      db.product.count({ where: { workspaceId, status: 'analyzed' } }),
      db.product.count({ where: { workspaceId, status: 'imported' } }),
      db.order.count({ where: { workspaceId } }),
      db.order.count({ where: { workspaceId, status: 'pending' } }),
      db.order.count({ where: { workspaceId, fulfillmentStatus: 'fulfilled' } }),
      db.supplier.count({ where: { workspaceId } }),
      db.supplier.count({ where: { workspaceId, verifiedBadge: true } }),
      db.trend.count({ where: { workspaceId } }),
      db.trend.count({ where: { workspaceId, status: 'active' } }),
      db.trend.count({ where: { workspaceId, aiRecommendation: 'buy' } }),
      db.store.count({ where: { workspaceId } }),
      db.store.count({ where: { workspaceId, status: 'connected' } }),
      db.commerceAnalytic.aggregate({
        where: { workspaceId, metricType: 'revenue' },
        _sum: { value: true },
      }),
    ]);

    return {
      revenue: {
        total: revenueMetrics._sum.value || 0,
        change: 0,
        period: 'all',
      },
      products: { total: productCount, analyzed: analyzedCount, imported: importedCount },
      orders: { total: totalOrders, pending: pendingOrders, fulfilled: fulfilledOrders },
      suppliers: { total: totalSuppliers, verified: verifiedSuppliers, active: verifiedSuppliers },
      trends: { total: totalTrends, active: activeTrends, buyRecommendations: buyTrends },
      stores: { total: totalStores, connected: connectedStores, disconnected: totalStores - connectedStores },
    };
  }

  // ─── Private helpers ───

  private computePeriodRange(date: Date, period: AnalyticPeriod): { periodStart: Date; periodEnd: Date } {
    const start = new Date(date);
    const end = new Date(date);

    switch (period) {
      case 'hourly':
        start.setMinutes(0, 0, 0);
        end.setHours(start.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 7);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        break;
      case 'yearly':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(start.getFullYear() + 1);
        break;
    }

    return { periodStart: start, periodEnd: end };
  }

  private getPeriodStart(period: AnalyticPeriod): Date {
    const now = new Date();
    switch (period) {
      case 'hourly': return new Date(now.getTime() - 60 * 60 * 1000);
      case 'daily': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'weekly': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'monthly': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'yearly': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  }

  private getPreviousPeriodStart(period: AnalyticPeriod): Date {
    const now = new Date();
    switch (period) {
      case 'hourly': return new Date(now.getTime() - 2 * 60 * 60 * 1000);
      case 'daily': return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      case 'weekly': return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      case 'monthly': return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      case 'yearly': return new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    }
  }
}

// ─── Singleton ───

let instance: CommerceAnalytics | null = null;

export function getCommerceAnalytics(): CommerceAnalytics {
  if (!instance) instance = new CommerceAnalytics();
  return instance;
}
