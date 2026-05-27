'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Target, Search, Filter, Package, DollarSign, TrendingUp,
  TrendingDown, AlertCircle, ChevronDown, ChevronUp, Sparkles,
  BarChart3, RefreshCcw, Loader2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function ScoreBar({ value, label, color = 'bg-blue-500' }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

export function ProductIntelligencePanel() {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/commerce/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'product-hunter',
          input: { niche: niche || 'general', minDemandScore: 50, maxCompetition: 80 },
          workspaceId: 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.output?.products) {
        setResults(json.data.output.products);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search products';
      setError(message);
      toast({ title: 'Search failed', description: message, variant: 'destructive' });
    }
    setLoading(false);
  }, [niche]);

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Product Intelligence</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Discover winning products with AI-powered demand, competition, and profit analysis
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

      {/* Search */}
      <motion.div variants={itemVariants} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search niche or category (e.g., 'fitness', 'home office', 'pet supplies')"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span className="ml-2">{loading ? 'Analyzing...' : 'Hunt Products'}</span>
        </Button>
      </motion.div>

      {/* Results */}
      {results && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {results.length} product opportunities found
            </p>
            <Button variant="outline" size="sm" onClick={handleSearch} disabled={loading}>
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
          <div className="grid gap-4">
            {results.map((product: any, idx: number) => {
              const isExpanded = expandedProduct === product.name;
              const scoreColor = product.overallScore >= 75 ? 'text-blue-600 dark:text-blue-400' :
                product.overallScore >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500';
              return (
                <Card key={product.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : product.name)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">#{idx + 1}</span>
                          <CardTitle className="text-sm font-semibold">{product.name}</CardTitle>
                          <Badge variant="secondary" className="text-[10px]">
                            {product.marketOpportunity >= 70 ? 'High Opportunity' : 'Medium'}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-1">{product.rationale}</CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={cn('text-lg font-bold tabular-nums', scoreColor)}>{product.overallScore}</p>
                          <p className="text-[10px] text-slate-400">Score</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      <Separator />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500">Demand</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{product.demandScore}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500">Competition</p>
                          <p className="text-lg font-bold text-slate-600 dark:text-slate-400">{product.competitionLevel}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500">Profit Margin</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{product.profitMargin}%</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500">Viral Potential</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{product.viralPotential}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <ScoreBar value={product.demandScore} label="Demand Score" color="bg-blue-500" />
                        <ScoreBar value={100 - product.competitionLevel} label="Competition Advantage" color="bg-blue-500" />
                        <ScoreBar value={product.saturationScore} label="Saturation" color="bg-slate-400" />
                        <ScoreBar value={product.marketOpportunity} label="Market Opportunity" color="bg-blue-500" />
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-20">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
            <Target className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ready to hunt products</h3>
          <p className="text-xs text-slate-400">Enter a niche above and click "Hunt Products" to discover winning opportunities</p>
        </motion.div>
      )}
    </motion.div>
  );
}
