'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Activity, Users, Package, ShoppingCart, Loader2,
  RefreshCcw, Sparkles, Target, AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function MetricCard({ title, value, change, icon: Icon, trend }: {
  title: string; value: string; change?: string; icon: React.ComponentType<{ className?: string }>; trend?: 'up' | 'down';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1 tabular-nums">{value}</p>
            {change && (
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-blue-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-slate-400" />
                )}
                <span className={cn('text-[11px] font-medium', trend === 'up' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')}>
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight }: { insight: any }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-blue-100 dark:bg-blue-900/30">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{insight.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{insight.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-[10px]">{insight.category}</Badge>
              <span className="text-[10px] text-slate-400">{insight.confidence}% confidence</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, agentRes] = await Promise.all([
        fetch('/api/commerce/analytics/dashboard?workspaceId=default'),
        fetch('/api/commerce/agents/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentType: 'analytics-agent',
            input: { type: activeTab, workspaceId: 'default' },
            workspaceId: 'default',
          }),
        }),
      ]);
      const dashJson = await dashRes.json();
      if (dashJson.success) setDashboard(dashJson.data);
      const agentJson = await agentRes.json();
      if (agentJson.success && agentJson.data?.output?.insights) {
        setInsights(agentJson.data.output.insights);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
      toast({ title: 'Data load failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metrics = dashboard || {
    totalRevenue: '$0', revenueChange: '0%', revenueTrend: 'up',
    totalOrders: '0', ordersChange: '0', ordersTrend: 'up',
    avgOrderValue: '$0', aovChange: '0%', aovTrend: 'up',
    activeProducts: '0', productsChange: '0', productsTrend: 'up',
    conversionRate: '0%', conversionTrend: 'up',
    fulfillmentRate: '0%', fulfillmentTrend: 'up',
  };

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Commerce intelligence and performance metrics</p>
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
        <MetricCard title="Revenue" value={metrics.totalRevenue} change={metrics.revenueChange} icon={DollarSign} trend={metrics.revenueTrend} />
        <MetricCard title="Orders" value={metrics.totalOrders} change={metrics.ordersChange} icon={ShoppingCart} trend={metrics.ordersTrend} />
        <MetricCard title="Avg. Order" value={metrics.avgOrderValue} change={metrics.aovChange} icon={Activity} trend={metrics.aovTrend} />
        <MetricCard title="Products" value={metrics.activeProducts} change={metrics.productsChange} icon={Package} trend={metrics.productsTrend} />
        <MetricCard title="Conversion" value={metrics.conversionRate} icon={Target} />
        <MetricCard title="Fulfillment" value={metrics.fulfillmentRate} icon={Package} />
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {insights.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">AI Insights</h3>
              <div className="grid gap-3">
                {insights.map((insight, idx) => (
                  <InsightCard key={idx} insight={insight} />
                ))}
              </div>
            </div>
          )}
          {!loading && insights.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No insights available yet. Run analytics to generate intelligence.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue Intelligence</CardTitle>
              <CardDescription className="text-xs">Detailed revenue breakdown and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 text-center py-8">
                Revenue analysis will populate with real data as orders are processed.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Operational Efficiency</CardTitle>
              <CardDescription className="text-xs">Automation and workflow performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 text-center py-8">
                Efficiency metrics will populate as automation runs execute.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fulfillment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fulfillment Analytics</CardTitle>
              <CardDescription className="text-xs">Order fulfillment performance and carrier metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 text-center py-8">
                Fulfillment analytics will populate as orders are fulfilled.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
