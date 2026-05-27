'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3,
  ShoppingCart, Users, Activity, Target, Calendar,
  CreditCard, ArrowUpRight, ArrowDownRight, Loader2,
  RefreshCcw, AlertCircle, Sparkles, PiggyBank,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function TrendIndicator({ value, trend }: { value: string; trend?: 'up' | 'down' | 'neutral' }) {
  if (!trend || trend === 'neutral') return <span className="text-xs text-slate-500">{value}</span>;
  return (
    <div className={cn(
      'flex items-center gap-0.5 text-xs font-medium',
      trend === 'up' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'
    )}>
      {trend === 'up' ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {value}
    </div>
  );
}

function MetricTile({ title, value, subtitle, icon: Icon, trend, loading: isLoading }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}) {
  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        ) : (
          <>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">{value}</p>
            {subtitle && <TrendIndicator value={subtitle} trend={trend} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight, idx }: { insight: any; idx: number }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-blue-100 dark:bg-blue-900/30">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{insight.title || `Insight ${idx + 1}`}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{insight.description || insight}</p>
            {insight.impact && (
              <Badge variant="secondary" className="text-[10px] mt-1.5">
                {insight.impact} impact
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueOperationsPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revRes, insightRes] = await Promise.all([
        fetch('/api/commerce/revenue?workspaceId=default'),
        fetch('/api/commerce/revenue?workspaceId=default&type=insights'),
      ]);
      const revJson = await revRes.json();
      if (revJson.success) setMetrics(revJson.data);
      const insightJson = await insightRes.json();
      if (insightJson.success) setInsights(insightJson.data || []);
    } catch (err) {
      setError('Failed to load revenue data');
      toast({ title: 'Load failed', description: 'Could not fetch revenue metrics', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const defaultMetrics = {
    totalRevenue: '$0',
    revenueChange: '0%',
    revenueTrend: 'neutral' as const,
    mrr: '$0',
    mrrChange: '0%',
    mrrTrend: 'neutral' as const,
    totalOrders: 0,
    ordersChange: '0',
    ordersTrend: 'neutral' as const,
    avgOrderValue: '$0',
    aovChange: '0%',
    aovTrend: 'neutral' as const,
    customerCount: 0,
    customerChange: '0',
    customerTrend: 'neutral' as const,
    conversionRate: '0%',
    churnRate: '0%',
    grossMargin: '0%',
    projectedRevenue: '$0',
  };

  const m = metrics || defaultMetrics;

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Revenue Operations</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Executive revenue dashboard with AI-powered insights and forecasting
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* KPI Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile title="Total Revenue" value={m.totalRevenue} subtitle={m.revenueChange} icon={DollarSign} trend={m.revenueTrend} loading={loading} />
        <MetricTile title="Monthly Recurring" value={m.mrr} subtitle={m.mrrChange} icon={TrendingUp} trend={m.mrrTrend} loading={loading} />
        <MetricTile title="Orders" value={String(m.totalOrders)} subtitle={m.ordersChange} icon={ShoppingCart} trend={m.ordersTrend} loading={loading} />
        <MetricTile title="Avg. Order Value" value={m.avgOrderValue} subtitle={m.aovChange} icon={Activity} trend={m.aovTrend} loading={loading} />
        <MetricTile title="Customers" value={String(m.customerCount)} subtitle={m.customerChange} icon={Users} trend={m.customerTrend} loading={loading} />
        <MetricTile title="Conversion" value={m.conversionRate} subtitle={`Churn: ${m.churnRate}`} icon={Target} trend="neutral" loading={loading} />
      </motion.div>

      {/* Profitability Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <PiggyBank className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Gross Margin</p>
              <p className="text-lg font-bold tabular-nums">{m.grossMargin}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Churn Rate</p>
              <p className="text-lg font-bold tabular-nums">{m.churnRate}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Projected Revenue</p>
              <p className="text-lg font-bold tabular-nums">{m.projectedRevenue}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-500 font-medium">LTV / CAC</p>
              <p className="text-lg font-bold tabular-nums">—</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Revenue Insights</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.slice(0, 6).map((insight, idx) => (
              <InsightCard key={idx} insight={insight} idx={idx} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Revenue Breakdown
          </TabsTrigger>
          <TabsTrigger value="forecast">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            AI Insights
            {insights.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{insights.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue Breakdown</CardTitle>
              <CardDescription className="text-xs">Detailed revenue by product, channel, and period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2">By Product</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-xs">Top Product</span>
                      <span className="text-xs font-medium text-slate-500">—</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-xs">Others</span>
                      <span className="text-xs font-medium text-slate-500">—</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2">By Channel</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-xs">Direct</span>
                      <span className="text-xs font-medium text-slate-500">—</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-xs">Marketplace</span>
                      <span className="text-xs font-medium text-slate-500">—</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-6">Detailed breakdown populates as revenue data is collected</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue Forecast</CardTitle>
              <CardDescription className="text-xs">AI-powered revenue projections and trend analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {m.projectedRevenue !== '$0' && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <p className="text-sm font-medium">30-Day Projection</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{m.projectedRevenue}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 text-center py-4">
                  Forecast accuracy improves as more revenue data is collected
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-4 space-y-3">
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} idx={idx} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No revenue insights yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">AI insights will generate as revenue data accumulates</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
