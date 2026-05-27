'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, Search, Sparkles, Loader2, RefreshCcw,
  ShieldCheck, AlertTriangle, Star, Package, AlertCircle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function SupplierCard({ supplier, rank }: { supplier: any; rank: number }) {
  const recColors: Record<string, string> = {
    highly_recommended: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    recommended: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    caution: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-500 border-slate-200 dark:border-slate-700',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{supplier.name}</CardTitle>
              <Badge variant="outline" className={cn('text-[10px]', recColors[supplier.recommendation] || '')}>
                {supplier.recommendation?.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary" className="text-[10px] capitalize">{supplier.type}</Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Overall Score: <span className="font-semibold">{supplier.overallScore}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{supplier.trustScore}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Trust</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{supplier.trustScore}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Shipping</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{supplier.shippingScore}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Pricing</p>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{supplier.pricingScore}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-500">Risk</p>
            <p className="text-sm font-bold text-red-500">{supplier.riskScore}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SupplierAnalysisPanel() {
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'supplier-analyst',
          input: { productName: productName || '' },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.suppliers) {
        setSuppliers(json.data.output.suppliers);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze suppliers';
      setError(message);
      toast({ title: 'Analysis failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [productName]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Supplier Analysis</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI-powered supplier intelligence with trust scoring, pricing comparison, and risk assessment
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
            placeholder="Product name for supplier analysis"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="ml-2">{loading ? 'Analyzing...' : 'Analyze Suppliers'}</span>
        </Button>
      </motion.div>

      {suppliers && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{suppliers.length} suppliers analyzed</p>
            <Button variant="outline" size="sm" onClick={handleSearch} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
          <div className="grid gap-4">
            {suppliers.map((s, idx) => (
              <SupplierCard key={s.name} supplier={s} rank={idx + 1} />
            ))}
          </div>
        </motion.div>
      )}

      {!suppliers && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <Truck className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Intelligence Ready</h3>
          <p className="text-xs text-slate-400">Enter a product name to analyze suppliers and get trust scores</p>
        </motion.div>
      )}
    </motion.div>
  );
}
