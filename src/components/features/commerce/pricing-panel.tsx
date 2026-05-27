'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Sparkles, Loader2, TrendingUp, TrendingDown, AlertCircle,
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

export function PricingPanel() {
  const [productName, setProductName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'pricing-agent',
          input: { productName, costPrice: parseFloat(costPrice) || 0, targetMargin: 30 },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.pricing) {
        setPricing(json.data.output);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze pricing';
      setError(message);
      toast({ title: 'Analysis failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [productName, costPrice]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Pricing Intelligence</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          AI-powered pricing optimization with margin analysis and competitive positioning
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

      <motion.div variants={itemVariants} className="space-y-3">
        <Input
          placeholder="Product name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
        <Input
          placeholder="Cost price (e.g., 12.99)"
          type="number"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
        />
        <Button onClick={handleAnalyze} disabled={loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? 'Analyzing...' : 'Optimize Pricing'}
        </Button>
      </motion.div>

      {pricing && (
        <motion.div variants={itemVariants} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recommended Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  ${pricing.pricing?.suggestedRetailPrice?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-slate-500">Suggested Retail Price</p>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                {pricing.tiers?.map((tier: any) => (
                  <div key={tier.name} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-xs text-slate-500 mb-1">{tier.name}</p>
                    <p className="text-sm font-bold">${tier.price.toFixed(2)}</p>
                    <p className="text-[10px] text-blue-500">{tier.margin}% margin</p>
                  </div>
                ))}
              </div>
              {pricing.pricing?.recommendation && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                  <p className="text-xs text-blue-700 dark:text-blue-300">{pricing.pricing.recommendation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
