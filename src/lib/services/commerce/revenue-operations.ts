// ═══════════════════════════════════════════════════════════════
// AMEO AI — Revenue Operations Dashboard (System 9)
// Executive operational dashboard with revenue metrics, margins,
// operational efficiency, AGI execution analytics, supplier
// performance, and fulfillment health.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getEventBus } from '@/lib/services/event-bus';

// ─── Types ───

export interface RevenueSummary {
  currentPeriod: MetricValue;
  previousPeriod: MetricValue;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricValue {
  revenue: number;
  grossMargin: number;
  netMargin: number;
  profit: number;
  avgOrderValue: number;
  totalOrders: number;
  totalProducts: number;
}

export interface OperationalEfficiency {
  automationRate: number;
  fulfillmentHealth: number;
  agentEfficiency: number;
  supplierPerformance: number;
  overallEfficiency: number;
}

export interface RevenueChartData {
  labels: string[];
  revenue: number[];
  profit: number[];
  orders: number[];
}

export interface PerformanceBreakdown {
  byChannel: Array<{ channel: string; revenue: number; percentage: number }>;
  byProduct: Array<{ product: string; revenue: number; percentage: number }>;
  byPlatform: Array<{ platform: string; revenue: number; orders: number }>;
}

// ─── Revenue Operations Service ───

export class RevenueOperations {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ─── Revenue Summary ───

  async getRevenueSummary(): Promise<RevenueSummary> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.computeMetricsForPeriod(periodStart, now),
      this.computeMetricsForPeriod(prevPeriodStart, periodStart),
    ]);

    const change = previousMetrics.revenue > 0
      ? ((currentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100
      : 0;

    const trend: 'up' | 'down' | 'stable' =
      change > 5 ? 'up' : change < -5 ? 'down' : 'stable';

    return {
      currentPeriod: currentMetrics,
      previousPeriod: previousMetrics,
      change: Math.round(change * 100) / 100,
      trend,
    };
  }

  private async computeMetricsForPeriod(start: Date, end: Date): Promise<MetricValue> {
    const orders = await db.order.findMany({
      where: {
        workspaceId: this.workspaceId,
        createdAt: { gte: start, lt: end },
        status: { notIn: ['cancelled', 'returned'] },
      },
    });

    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

    const products = await db.product.count({
      where: { workspaceId: this.workspaceId },
    });

    // Estimate margins from product data
    const productsWithCosts = await db.product.findMany({
      where: {
        workspaceId: this.workspaceId,
        price: { not: null },
        costPrice: { not: null },
      },
    });

    const marginData = productsWithCosts
      .map((p) => {
        if (p.price && p.price > 0) {
          return (p.price - (p.costPrice || 0)) / p.price;
        }
        return 0;
      })
      .filter((m) => m > 0);

    const avgMargin =
      marginData.length > 0
        ? marginData.reduce((sum, m) => sum + m, 0) / marginData.length
        : 0;

    const grossMargin = avgMargin * 100;
    const netMargin = grossMargin * 0.7; // Simplified: net after operational costs
    const profit = revenue * (grossMargin / 100) * 0.7; // Simplified net profit

    return {
      revenue: Math.round(revenue * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      netMargin: Math.round(netMargin * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalOrders,
      totalProducts: products,
    };
  }

  // ─── Operational Efficiency ───

  async getOperationalEfficiency(): Promise<OperationalEfficiency> {
    const totalOrders = await db.order.count({
      where: { workspaceId: this.workspaceId },
    });
    const autoFulfilled = await db.order.count({
      where: { workspaceId: this.workspaceId, autoFulfilled: true },
    });
    const automationRate = totalOrders > 0
      ? (autoFulfilled / totalOrders) * 100
      : 0;

    // Fulfillment health
    const fulfilled = await db.order.count({
      where: { workspaceId: this.workspaceId, fulfillmentStatus: 'fulfilled' },
    });
    const failed = await db.order.count({
      where: { workspaceId: this.workspaceId, fulfillmentStatus: 'cancelled' },
    });
    const totalFulfilled = fulfilled + failed;
    const fulfillmentHealth = totalFulfilled > 0
      ? (fulfilled / totalFulfilled) * 100
      : 0;

    // Agent efficiency (based on runtime executions)
    const executions = await db.runtimeExecution.findMany({
      where: { workspaceId: this.workspaceId },
    });
    const successful = executions.filter((e) => e.status === 'completed').length;
    const agentEfficiency = executions.length > 0
      ? (successful / executions.length) * 100
      : 0;

    // Supplier performance
    const suppliers = await db.supplier.findMany({
      where: { workspaceId: this.workspaceId },
    });
    const avgSupplierScore = suppliers.length > 0
      ? suppliers.reduce((sum, s) => sum + (s.overallScore || 0), 0) / suppliers.length
      : 0;

    // Overall composite
    const overallEfficiency =
      automationRate * 0.25 +
      fulfillmentHealth * 0.25 +
      agentEfficiency * 0.25 +
      avgSupplierScore * 0.25;

    return {
      automationRate: Math.round(automationRate * 100) / 100,
      fulfillmentHealth: Math.round(fulfillmentHealth * 100) / 100,
      agentEfficiency: Math.round(agentEfficiency * 100) / 100,
      supplierPerformance: Math.round(avgSupplierScore * 100) / 100,
      overallEfficiency: Math.round(overallEfficiency * 100) / 100,
    };
  }

  // ─── Chart Data ───

  async getRevenueChart(days = 30): Promise<RevenueChartData> {
    const labels: string[] = [];
    const revenue: number[] = [];
    const profit: number[] = [];
    const orders: number[] = [];

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayOrders = await db.order.findMany({
        where: {
          workspaceId: this.workspaceId,
          createdAt: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['cancelled', 'returned'] },
        },
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const dayOrderCount = dayOrders.length;

      labels.push(dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      revenue.push(Math.round(dayRevenue * 100) / 100);
      profit.push(Math.round(dayRevenue * 0.28 * 100) / 100); // ~28% net margin estimate
      orders.push(dayOrderCount);
    }

    return { labels, revenue, profit, orders };
  }

  // ─── Performance Breakdown ───

  async getPerformanceBreakdown(): Promise<PerformanceBreakdown> {
    // By store/channel
    const stores = await db.store.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const byChannel: Array<{ channel: string; revenue: number; percentage: number }> = [];
    const byPlatform: Array<{ platform: string; revenue: number; orders: number }> = [];

    let totalRevenue = 0;
    for (const store of stores) {
      const storeOrders = await db.order.findMany({
        where: { storeId: store.id, status: { notIn: ['cancelled', 'returned'] } },
      });
      const storeRevenue = storeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      totalRevenue += storeRevenue;

      byChannel.push({ channel: store.name, revenue: storeRevenue, percentage: 0 });
      byPlatform.push({ platform: store.platform, revenue: storeRevenue, orders: storeOrders.length });
    }

    // Calculate percentages
    for (const channel of byChannel) {
      channel.percentage = totalRevenue > 0
        ? Math.round((channel.revenue / totalRevenue) * 10000) / 100
        : 0;
    }

    // By product (top 5)
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          workspaceId: this.workspaceId,
          status: { notIn: ['cancelled', 'returned'] },
        },
      },
      include: { product: true },
      take: 100,
    });

    const productRevenueMap = new Map<string, { name: string; revenue: number }>();
    for (const item of orderItems) {
      const productName = item.product?.name || item.name;
      const itemRevenue = (item.totalPrice || 0);
      const existing = productRevenueMap.get(productName) || { name: productName, revenue: 0 };
      existing.revenue += itemRevenue;
      productRevenueMap.set(productName, existing);
    }

    const sortedProducts = Array.from(productRevenueMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const byProduct = sortedProducts.map((p) => ({
      product: p.name,
      revenue: Math.round(p.revenue * 100) / 100,
      percentage: totalRevenue > 0
        ? Math.round((p.revenue / totalRevenue) * 10000) / 100
        : 0,
    }));

    return { byChannel, byProduct, byPlatform };
  }

  // ─── AGI Execution Metrics ───

  async getAgiMetrics(): Promise<{
    totalExecutions: number;
    successRate: number;
    averageLatencyMs: number;
    tokensUsed: number;
    topAgent: string | null;
  }> {
    const executions = await db.runtimeExecution.findMany({
      where: { workspaceId: this.workspaceId },
    });

    const totalExecutions = executions.length;
    const successful = executions.filter((e) => e.status === 'completed').length;
    const successRate = totalExecutions > 0
      ? (successful / totalExecutions) * 100
      : 0;

    const withLatency = executions.filter((e) => e.latencyMs);
    const averageLatencyMs = withLatency.length > 0
      ? Math.round(withLatency.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / withLatency.length)
      : 0;

    const tokensUsed = executions.reduce((sum, e) => {
      try {
        if (e.tokenUsage) {
          const usage = JSON.parse(e.tokenUsage) as Record<string, number>;
          return sum + (usage.totalTokens || 0);
        }
      } catch {
        // ignore
      }
      return sum;
    }, 0);

    return {
      totalExecutions,
      successRate: Math.round(successRate * 100) / 100,
      averageLatencyMs,
      tokensUsed,
      topAgent: null, // Would require agent tracking
    };
  }

  // ─── Store Metric Recording ───

  async recordMetric(data: {
    metricType: string;
    period: string;
    periodStart: Date;
    periodEnd: Date;
    value: number;
    target?: number;
    previousValue?: number;
    byChannel?: Record<string, number>;
    byProduct?: Record<string, number>;
  }): Promise<void> {
    const existing = await db.revenueMetric.findUnique({
      where: {
        workspaceId_metricType_period_periodStart: {
          workspaceId: this.workspaceId,
          metricType: data.metricType,
          period: data.period,
          periodStart: data.periodStart,
        },
      },
    });

    if (existing) {
      await db.revenueMetric.update({
        where: { id: existing.id },
        data: {
          value: data.value,
          target: data.target,
          previousValue: data.previousValue,
          byChannel: data.byChannel ? JSON.stringify(data.byChannel) : undefined,
          byProduct: data.byProduct ? JSON.stringify(data.byProduct) : undefined,
        },
      });
    } else {
      await db.revenueMetric.create({
        data: {
          workspaceId: this.workspaceId,
          metricType: data.metricType,
          period: data.period,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          value: data.value,
          target: data.target,
          previousValue: data.previousValue,
          byChannel: data.byChannel ? JSON.stringify(data.byChannel) : undefined,
          byProduct: data.byProduct ? JSON.stringify(data.byProduct) : undefined,
        },
      });
    }
  }

  // ─── Compute & Store Metrics ───

  async computeMetrics(): Promise<void> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const summary = await this.getRevenueSummary();
    const efficiency = await this.getOperationalEfficiency();
    const breakdown = await this.getPerformanceBreakdown();

    // Store revenue metric
    await this.recordMetric({
      metricType: 'revenue',
      period: 'monthly',
      periodStart: monthStart,
      periodEnd: monthEnd,
      value: summary.currentPeriod.revenue,
      previousValue: summary.previousPeriod.revenue,
      byChannel: Object.fromEntries(
        breakdown.byChannel.map((c) => [c.channel, c.revenue])
      ),
      byProduct: Object.fromEntries(
        breakdown.byProduct.slice(0, 3).map((p) => [p.product, p.revenue])
      ),
    });

    // Store efficiency metrics
    await Promise.all([
      this.recordMetric({
        metricType: 'operational_efficiency',
        period: 'monthly',
        periodStart: monthStart,
        periodEnd: monthEnd,
        value: efficiency.overallEfficiency,
        target: 80,
      }),
      this.recordMetric({
        metricType: 'automation_rate',
        period: 'monthly',
        periodStart: monthStart,
        periodEnd: monthEnd,
        value: efficiency.automationRate,
        target: 60,
      }),
      this.recordMetric({
        metricType: 'fulfillment_health',
        period: 'monthly',
        periodStart: monthStart,
        periodEnd: monthEnd,
        value: efficiency.fulfillmentHealth,
        target: 95,
      }),
      this.recordMetric({
        metricType: 'agent_efficiency',
        period: 'monthly',
        periodStart: monthStart,
        periodEnd: monthEnd,
        value: efficiency.agentEfficiency,
        target: 85,
      }),
    ]);

    const eventBus = getEventBus();
    await eventBus.emit({
      workspaceId: this.workspaceId,
      eventType: 'revenue-metrics.computed',
      source: 'revenue-operations',
      level: 'info',
      payload: {
        revenue: summary.currentPeriod.revenue,
        efficiency: efficiency.overallEfficiency,
        period: monthStart.toISOString(),
      },
    });
  }

  // ─── Dashboard Data ───

  async getDashboard(): Promise<{
    summary: RevenueSummary;
    efficiency: OperationalEfficiency;
    chart: RevenueChartData;
    breakdown: PerformanceBreakdown;
    agiMetrics: {
      totalExecutions: number;
      successRate: number;
      averageLatencyMs: number;
      tokensUsed: number;
    };
  }> {
    const [summary, efficiency, chart, breakdown, agiMetrics] = await Promise.all([
      this.getRevenueSummary(),
      this.getOperationalEfficiency(),
      this.getRevenueChart(30),
      this.getPerformanceBreakdown(),
      this.getAgiMetrics(),
    ]);

    return { summary, efficiency, chart, breakdown, agiMetrics };
  }
}
