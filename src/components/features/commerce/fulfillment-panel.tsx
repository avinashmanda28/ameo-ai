'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Package, Search, Sparkles, Loader2, RefreshCcw,
  Clock, MapPin, CheckCircle, AlertCircle, Truck,
  BarChart3,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipped: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  returned: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500',
};

function OrderCard({ order }: { order: any }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Order #{order.orderId || order.id?.slice(0, 8)}</CardTitle>
              <Badge variant="secondary" className={cn('text-[10px] capitalize', STATUS_STYLES[order.status])}>
                {order.status}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">{order.productName || 'Order'}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">${order.total?.toFixed(2) || '0.00'}</p>
            <p className="text-[10px] text-slate-400">{order.quantity || 1} unit(s)</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{order.shippingAddress || 'Address pending'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 dark:text-slate-400">{order.carrier || 'Carrier pending'}</span>
          </div>
        </div>
        {order.trackingNumber && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tracking:</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">{order.trackingNumber}</span>
          </div>
        )}
        {order.estimatedDelivery && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Est. delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}</span>
          </div>
        )}
        {order.fulfillmentSteps && (
          <div className="space-y-1">
            {order.fulfillmentSteps.map((step: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {step.completed ? (                    <CheckCircle className="w-3 h-3 text-blue-500" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600" />
                )}
                <span className={cn(step.completed ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400')}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FulfillmentPanel() {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'fulfillment-agent',
          input: { orderId: orderId || undefined, workspaceId: 'default' },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.orders) {
        setOrders(json.data.output.orders);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search orders';
      setError(message);
      toast({ title: 'Search failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [orderId]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Fulfillment</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Order fulfillment management with tracking, status monitoring, and delivery insights
        </p>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by order ID or leave empty for all orders"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="ml-2">{loading ? 'Loading...' : 'Search Orders'}</span>
        </Button>
      </motion.div>

      {orders && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{orders.length} orders found</p>
            <Button variant="outline" size="sm" onClick={handleSearch} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
          <div className="grid gap-4">
            {orders.map((order, idx) => (
              <OrderCard key={order.id || idx} order={order} />
            ))}
          </div>
        </motion.div>
      )}

      {!orders && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fulfillment Dashboard</h3>
          <p className="text-xs text-slate-400">Search orders to view tracking, status, and delivery information</p>
        </motion.div>
      )}
    </motion.div>
  );
}
